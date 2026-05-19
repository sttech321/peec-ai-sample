import { db } from "../db";
import {
  chats,
  sources,
  citations,
  brandMentions,
  brands,
  prompts,
} from "../db/schema";
import { and, eq } from "drizzle-orm";
import { callAIEngine, extractBrandsWithLLM } from "./ai-clients";

export type PipelineJob = {
  workspaceId: string;
  promptId: string;
  engine: string;
  runDate: string;
  query: string;
};

/**
 * Inline pipeline used as a fallback when the Inngest dev server is unreachable.
 * Mirrors the steps in `runPromptPipeline` (inngest/functions.ts) but without
 * step-level retries / idempotency — invoke from Inngest in production.
 */
export async function runPipelineForOneEngine(job: PipelineJob): Promise<void> {
  const { workspaceId, promptId, engine, runDate, query } = job;

  // 1. Call AI engine
  const aiResponse = await callAIEngine(engine, query);

  // 2. Persist chat (record failures too)
  const rawResponse = aiResponse.ok
    ? aiResponse.text
    : `[ERROR:${aiResponse.errorCode}] ${aiResponse.error}`;
  const modelSnapshot = aiResponse.ok
    ? aiResponse.modelSnapshot
    : `error:${aiResponse.modelSnapshot}`;
  const [insertedChat] = await db
    .insert(chats)
    .values({
      workspaceId,
      promptId,
      engine,
      modelSnapshot,
      runDate: new Date(runDate),
      rawResponse,
    })
    .returning({ id: chats.id });
  const chatId = insertedChat.id;

  if (!aiResponse.ok) return;

  // 3. Persist sources and citations   
  if (aiResponse.citations && aiResponse.citations.length > 0) {
    for (const citation of aiResponse.citations) {
      const [insertedSource] = await db
        .insert(sources)
        .values({
          workspaceId,
          chatId,
          url: citation.url,
          domain: citation.domain || "unknown",
          title: citation.title || "Unknown",
        })
        .returning({ id: sources.id });

      await db.insert(citations).values({
        workspaceId,
        chatId,
        sourceId: insertedSource.id,
      });
    }
  }

  // 4. Extract brands
  const extractedBrands = await extractBrandsWithLLM(aiResponse.text);
  if (extractedBrands.length === 0) return;

  // 5. Persist brand mentions (auto-create brand rows on first sight).
  const [promptRecord] = await db
    .select()
    .from(prompts)
    .where(eq(prompts.id, promptId));
  if (!promptRecord) return;
  const projectId = promptRecord.projectId;

  for (const brand of extractedBrands) {
    const rawName = brand.brandId || brand.name || brand.mentionText;
    const brandName = typeof rawName === "string" ? rawName.trim() : "";
    // Skip empty / placeholder extractions so we don't pollute the brands table.
    if (!brandName) continue;

    let brandId: string;
    const existingBrand = await db
      .select({ id: brands.id })
      .from(brands)
      .where(and(eq(brands.projectId, projectId), eq(brands.name, brandName)));

    if (existingBrand.length > 0) {
      brandId = existingBrand[0].id;
    } else {
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

    // Store NULL when the LLM omits sentiment/position so SQL avg() ignores
    // them instead of skewing toward fake defaults (50 / 1). Both columns are
    // nullable in the schema.
    await db.insert(brandMentions).values({
      workspaceId,
      chatId,
      brandId,
      position: typeof brand.position === "number" ? brand.position : null,
      sentiment: typeof brand.sentiment === "number" ? brand.sentiment : null,
      confidence: typeof brand.confidence === "number" ? brand.confidence : null,
      mentionText: brand.mentionText || brandName,
    });
  }
}

export async function runPipelineForAllEngines(jobs: PipelineJob[]): Promise<void> {
  for (const job of jobs) {
    try {
      await runPipelineForOneEngine(job);
    } catch (err) {
      console.error(
        `[run-pipeline] job failed for engine=${job.engine} prompt=${job.promptId}:`,
        err,
      );
    }
  }
}
