import { db } from "../db";
import {
  chats,
  sources,
  citations,
  brandMentions,
  brands,
  brandSuggestions,
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

  // 5. Persist brand mentions / suggestions
  const [promptRecord] = await db
    .select()
    .from(prompts)
    .where(eq(prompts.id, promptId));
  if (!promptRecord) return;
  const projectId = promptRecord.projectId;

  for (const brand of extractedBrands) {
    const brandName =
      brand.brandId || brand.name || brand.mentionText || "Unknown Brand";

    const existingBrand = await db
      .select()
      .from(brands)
      .where(and(eq(brands.projectId, projectId), eq(brands.name, brandName)));

    if (existingBrand.length > 0) {
      await db.insert(brandMentions).values({
        workspaceId,
        chatId,
        brandId: existingBrand[0].id,
        position: brand.position || 1,
        sentiment: brand.sentiment || 50,
        confidence: brand.confidence || 0.8,
        mentionText: brand.mentionText || brandName,
      });
    } else {
      const existingSuggestion = await db
        .select()
        .from(brandSuggestions)
        .where(
          and(
            eq(brandSuggestions.projectId, projectId),
            eq(brandSuggestions.name, brandName),
          ),
        );

      if (existingSuggestion.length > 0) {
        await db
          .update(brandSuggestions)
          .set({
            mentions: existingSuggestion[0].mentions + 1,
            updatedAt: new Date(),
          })
          .where(eq(brandSuggestions.id, existingSuggestion[0].id));
      } else {
        await db.insert(brandSuggestions).values({
          workspaceId,
          projectId,
          name: brandName,
          mentions: 1,
          status: "pending",
        });
      }
    }
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
