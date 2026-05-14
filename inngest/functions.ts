import { inngest } from "./client";
import { db } from "../db";
import { chats, sources, citations, brandMentions, prompts } from "../db/schema";
import { eq } from "drizzle-orm";

export const scheduleDailyScans = inngest.createFunction(
  {
    id: "schedule-daily-scans",
    triggers: [{ cron: "TZ=UTC 0 6 * * *" }]
  },
  async ({ step }) => {
    const allPrompts = await step.run("fetch-all-prompts", async () => {
      return await db.select().from(prompts).where(eq(prompts.isActive, true));
    });

    const engines = ["ChatGPT", "Claude", "Perplexity", "Gemini", "AI Overviews"];
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

    // 5. Persist Brand Mentions
    if (extractedBrands.length > 0) {
      await step.run("persist-brand-mentions", async () => {
        const { brands, brandMentions, prompts } = await import("../db/schema");
        const { eq, and } = await import("drizzle-orm");

        // Find project ID from prompt
        const promptRecord = await db.select().from(prompts).where(eq(prompts.id, promptId));
        const projectId = promptRecord[0].projectId;

        for (const brand of extractedBrands) {
           let brandId = "";
           const brandName = brand.brandId || brand.name || brand.mentionText || "Unknown Brand";
           
           // 1. Check if brand exists in tracking
           const existingBrand = await db.select().from(brands).where(
              and(eq(brands.projectId, projectId), eq(brands.name, brandName))
           );
           
           if (existingBrand.length > 0) {
             brandId = existingBrand[0].id;
             
             // Persist Mention for tracked brand
             await db.insert(brandMentions).values({
               workspaceId,
               chatId,
               brandId,
               position: brand.position || 1,
               sentiment: brand.sentiment || 50,
               confidence: brand.confidence || 0.8,
               mentionText: brand.mentionText || brandName
             });
           } else {
             // 2. Not tracked -> Check if already suggested
             const { brandSuggestions } = await import("../db/schema");
             const existingSuggestion = await db.select().from(brandSuggestions).where(
               and(eq(brandSuggestions.projectId, projectId), eq(brandSuggestions.name, brandName))
             );

             if (existingSuggestion.length > 0) {
               // Increment mention count
               await db.update(brandSuggestions)
                 .set({ 
                   mentions: existingSuggestion[0].mentions + 1,
                   updatedAt: new Date()
                 })
                 .where(eq(brandSuggestions.id, existingSuggestion[0].id));
             } else {
               // New suggestion
               await db.insert(brandSuggestions).values({
                 workspaceId,
                 projectId,
                 name: brandName,
                 mentions: 1,
                 status: 'pending'
               });
             }
           }
        }
      });
    }

    return { success: true, chatId };
  }
);
