import { db } from "../db";
import {
  chats,
  sources,
  citations,
  brandMentions,
  brands,
  prompts,
} from "../db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { callAIEngine, extractBrandsWithLLM } from "./ai-clients";

export type PipelineJob = {
  workspaceId: string;
  promptId: string;
  engine: string;
  runDate: string;
  query: string;
};

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) console.log(`[pipeline] ✓ ${label} succeeded on attempt ${attempt}`);
      return result;
    } catch (err) {
      lastErr = err;
      console.warn(`[pipeline] ✗ ${label} attempt ${attempt}/${retries} failed:`, err);
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

export async function runPipelineForOneEngine(job: PipelineJob): Promise<void> {
  const { workspaceId, promptId, engine, runDate, query } = job;
  console.log(`[pipeline] START engine=${engine} prompt=${promptId}`);

  // Step 1: Call AI engine
  const aiResponse = await withRetry(
    () => callAIEngine(engine, query),
    `call-ai-engine [${engine}]`,
  );
  console.log(`[pipeline] step=call-ai-engine ok=${aiResponse.ok} engine=${engine}`);

  // Step 2: Persist chat (record failures too)
  const rawResponse = aiResponse.ok
    ? aiResponse.text
    : `[ERROR:${aiResponse.errorCode}] ${aiResponse.error}`;
  const modelSnapshot = aiResponse.ok
    ? aiResponse.modelSnapshot
    : `error:${aiResponse.modelSnapshot}`;

  const runDateObj = new Date(runDate);
  const insertedChat = await db
    .insert(chats)
    .values({ workspaceId, promptId, engine, modelSnapshot, runDate: runDateObj, rawResponse })
    .onConflictDoNothing()
    .returning({ id: chats.id });

  let chatId: string;
  if (insertedChat.length > 0) {
    chatId = insertedChat[0].id;
  } else {
    // Duplicate run same day — fetch existing record
    const [existing] = await db
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.promptId, promptId))
      .limit(1);
    chatId = existing.id;
  }
  console.log(`[pipeline] step=persist-chat chatId=${chatId}`);

  if (!aiResponse.ok) {
    console.warn(`[pipeline] engine=${engine} error — skipping citations/brands`);
    return;
  }

  // Step 3: Persist sources and citations
  if (aiResponse.citations && aiResponse.citations.length > 0) {
    await withRetry(async () => {
      for (const citation of aiResponse.citations) {
        const [insertedSource] = await db
          .insert(sources)
          .values({
            workspaceId, chatId,
            url: citation.url,
            domain: citation.domain || "unknown",
            title: citation.title || "Unknown",
          })
          .returning({ id: sources.id });

        await db.insert(citations).values({ workspaceId, chatId, sourceId: insertedSource.id });
      }
    }, `persist-citations [${engine}]`);
    console.log(`[pipeline] step=persist-citations count=${aiResponse.citations.length}`);
  }

  // Step 4: Extract brands with LLM
  const extractedBrands = await withRetry(
    () => extractBrandsWithLLM(aiResponse.text),
    `extract-brands [${engine}]`,
  );
  console.log(`[pipeline] step=extract-brands found=${extractedBrands.length}`);
  if (extractedBrands.length === 0) {
    console.log(`[pipeline] DONE engine=${engine} prompt=${promptId}`);
    return;
  }

  // Step 5: Persist brand mentions / suggestions
  const [promptRecord] = await db.select().from(prompts).where(eq(prompts.id, promptId));
  if (!promptRecord) return;
  const projectId = promptRecord.projectId;

  await withRetry(async () => {
    for (const brand of extractedBrands) {
      const rawName = brand.brandId || brand.name || brand.mentionText;
      const brandName = typeof rawName === "string" ? rawName.trim() : "";
      if (!brandName) continue;

      const existingBrand = await db
        .select({ id: brands.id })
        .from(brands)
        .where(and(
          eq(brands.projectId, projectId),
          or(
            sql`lower(${brands.name}) = lower(${brandName})`,
            sql`lower(${brandName}) = ANY(SELECT lower(unnest(${brands.aliases})))`,
          ),
        ))
        .limit(1);

      let brandId: string;
      if (existingBrand.length > 0) {
        brandId = existingBrand[0].id;
      } else {
        // Auto-create brand so mention is recorded immediately (visibility works)
        const [created] = await db
          .insert(brands)
          .values({
            workspaceId,
            projectId,
            name: brandName,
            isOwn: false,
            aliases: [],
            domains: [],
          })
          .returning({ id: brands.id });
        brandId = created.id;
      }

      await db.insert(brandMentions).values({
        workspaceId, chatId,
        brandId,
        position:    typeof brand.position   === "number" ? brand.position   : null,
        sentiment:   typeof brand.sentiment  === "number" ? brand.sentiment  : null,
        confidence:  typeof brand.confidence === "number" ? brand.confidence : null,
        mentionText: brand.mentionText || brandName,
      });
    }
  }, `persist-brand-mentions [${engine}]`);

  console.log(`[pipeline] step=persist-brand-mentions engine=${engine} done`);
  console.log(`[pipeline] DONE engine=${engine} prompt=${promptId}`);
}

export async function runPipelineForAllEngines(jobs: PipelineJob[]): Promise<void> {
  for (const job of jobs) {
    try {
      await runPipelineForOneEngine(job);
    } catch (err) {
      console.error(`[pipeline] job FAILED engine=${job.engine} prompt=${job.promptId}:`, err);
    }
  }
}
