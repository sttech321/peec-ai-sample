import { inngest } from "./client";
import { db } from "../db";
import { chats, sources, citations, brandMentions, prompts } from "../db/schema";
import { eq, gte, sql } from "drizzle-orm";
import { DEFAULT_ENGINES } from "../lib/ai-clients";

export const scheduleDailyScans = inngest.createFunction(
  {
    id: "schedule-daily-scans",
    triggers: [{ cron: "TZ=UTC 0 6 * * *" }]
  },
  async ({ step }) => {
    const allPrompts = await step.run("fetch-all-prompts", async () => {
      return await db.select().from(prompts).where(eq(prompts.isActive, true));
    });

    const engines = DEFAULT_ENGINES;
    const events = [];
    const runDate = new Date().toISOString().split('T')[0];
    
    for (const prompt of allPrompts) {
      for (const engine of engines) {
        events.push({
          name: "prompt.run",
          data: {
            workspaceId: prompt.workspaceId,
            promptId: prompt.id,
            engine: engine,
            runDate: runDate,
            query: prompt.query
          }
        });
      }
    }

    if (events.length > 0) {
      await step.sendEvent("dispatch-scans", events);
    }
    
    return { dispatched: events.length };
  }
);

export const runPromptPipeline = inngest.createFunction(
  { 
    id: "run-prompt-pipeline",
    retries: 3, 
    idempotency: "event.data.workspaceId + '-' + event.data.promptId + '-' + event.data.engine + '-' + event.data.runDate",
    triggers: [{ event: "prompt.run" }]
  },
  async ({ event, step }) => {
    const { workspaceId, promptId, engine, runDate, query } = event.data;

    // 1. Call AI Engine (OpenAI, Claude, Perplexity, etc.)
    const aiResponse = await step.run("call-ai-engine", async () => {
      const { callAIEngine } = await import("../lib/ai-clients");
      return await callAIEngine(engine, query);
    });

    // 2. Persist the Chat — record failures too so the dashboard can surface them.
    const chatId = await step.run("persist-chat", async () => {
      const rawResponse = aiResponse.ok
        ? aiResponse.text
        : `[ERROR:${aiResponse.errorCode}] ${aiResponse.error}`;
      const modelSnapshot = aiResponse.ok
        ? aiResponse.modelSnapshot
        : `error:${aiResponse.modelSnapshot}`;
      const inserted = await db.insert(chats).values({
        workspaceId,
        promptId,
        engine,
        modelSnapshot,
        runDate: new Date(runDate),
        rawResponse,
      }).returning({ id: chats.id });
      return inserted[0].id;
    });

    // Bail out early if the engine call failed — no citations / brands to extract.
    if (!aiResponse.ok) {
      return {
        success: false,
        chatId,
        engine,
        errorCode: aiResponse.errorCode,
        error: aiResponse.error,
      };
    }

    // 3. Persist Sources and Citations
    if (aiResponse.citations && aiResponse.citations.length > 0) {
      await step.run("persist-citations", async () => {
        for (const citation of aiResponse.citations) {
          const insertedSource = await db.insert(sources).values({
            workspaceId,
            chatId,
            url: citation.url,
            domain: citation.domain || "unknown",
            title: citation.title || "Unknown",
          }).returning({ id: sources.id });

          await db.insert(citations).values({
            workspaceId,
            chatId,
            sourceId: insertedSource[0].id,
          });
        }
      });
    }

    // 4. Extract Brands (Anthropic prompt caching here ideally)
    const extractedBrands = await step.run("extract-brands", async () => {
      const { extractBrandsWithLLM } = await import("../lib/ai-clients");
      return await extractBrandsWithLLM(aiResponse.text);
    });

    // 5. Persist Brand Mentions.
    //    - Known brands (already in `brands` table) → create a brandMention record.
    //    - Unknown brands → upsert into `brandSuggestions` so users can review
    //      and accept/reject them. Never auto-create brands; that bypasses the
    //      review workflow.
    if (extractedBrands.length > 0) {
      await step.run("persist-brand-mentions", async () => {
        const { brands, brandMentions, brandSuggestions, prompts } = await import("../db/schema");
        const { eq, and } = await import("drizzle-orm");

        const promptRecord = await db.select().from(prompts).where(eq(prompts.id, promptId));
        const projectId = promptRecord[0].projectId;

        for (const brand of extractedBrands) {
          const rawName = brand.brandId || brand.name || brand.mentionText;
          const brandName = typeof rawName === "string" ? rawName.trim() : "";
          if (!brandName) continue;

          // Check if this brand is already tracked
          const existingBrand = await db
            .select({ id: brands.id })
            .from(brands)
            .where(and(eq(brands.projectId, projectId), eq(brands.name, brandName)));

          if (existingBrand.length > 0) {
            // Tracked brand → record the mention
            await db.insert(brandMentions).values({
              workspaceId,
              chatId,
              brandId: existingBrand[0].id,
              position:    typeof brand.position  === "number" ? brand.position  : null,
              sentiment:   typeof brand.sentiment === "number" ? brand.sentiment : null,
              confidence:  typeof brand.confidence === "number" ? brand.confidence : null,
              mentionText: brand.mentionText || brandName,
            });
          } else {
            // Untracked brand → upsert into suggestions so the user can review
            const existingSug = await db
              .select({ id: brandSuggestions.id, mentions: brandSuggestions.mentions })
              .from(brandSuggestions)
              .where(and(
                eq(brandSuggestions.projectId, projectId),
                eq(brandSuggestions.name, brandName),
              ));

            if (existingSug.length > 0) {
              await db
                .update(brandSuggestions)
                .set({
                  mentions: (existingSug[0].mentions ?? 0) + 1,
                  updatedAt: new Date(),
                })
                .where(eq(brandSuggestions.id, existingSug[0].id));
            } else {
              await db.insert(brandSuggestions).values({
                workspaceId,
                projectId,
                name: brandName,
                domain: null,
                mentions: 1,
                status: "pending",
              });
            }
          }
        }
      });
    }

    return { success: true, chatId };
  }
);

// Runs 2 hours after the daily scan cron (6 AM UTC) to auto-generate
// earned + owned actions from the freshly stored scan data.
export const generateDailyActions = inngest.createFunction(
  {
    id: "generate-daily-actions",
    triggers: [{ cron: "TZ=UTC 0 8 * * *" }],
  },
  async ({ step }) => {
    // Find all distinct projects that have scan data from today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const projectsWithScans = await step.run("fetch-projects-with-today-scans", async () => {
      const result = await db
        .selectDistinct({
          projectId: prompts.projectId,
          workspaceId: prompts.workspaceId,
        })
        .from(chats)
        .innerJoin(prompts, eq(prompts.id, chats.promptId))
        .where(gte(chats.createdAt, todayStart));
      return result;
    });

    let generated = 0;
    let skipped = 0;

    for (const { projectId, workspaceId } of projectsWithScans) {
      const result = await step.run(`generate-actions-${projectId}`, async () => {
        const { generateActionsForProject } = await import("../lib/generate-actions");
        return generateActionsForProject(projectId, workspaceId);
      });

      if (result.skipped) skipped++;
      else generated++;
    }

    return { projects: projectsWithScans.length, generated, skipped };
  },
);
