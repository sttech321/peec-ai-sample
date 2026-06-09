import { NextResponse } from "next/server";
import { db } from "../../../db";
import { prompts } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_ENGINES } from "../../../lib/ai-clients";
import { runPipelineForAllEngines, type PipelineJob } from "../../../lib/run-pipeline";

export const runtime = "nodejs";

// Daily prompt-crawl trigger.
// Called by Render Cron at 6 AM UTC: GET /api/run-daily-scan
//
// GET /api/run-daily-scan            → all active prompts × all DEFAULT_ENGINES
// GET /api/run-daily-scan?promptId=… → one prompt × all DEFAULT_ENGINES
// GET /api/run-daily-scan?engines=ChatGPT,Claude → subset of engines
async function handler(req: Request) {
  const url = new URL(req.url);
  const promptIdFilter = url.searchParams.get("promptId");
  const enginesParam = url.searchParams.get("engines");
  const engines = enginesParam
    ? enginesParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_ENGINES];

  const activePrompts = promptIdFilter
    ? await db.select().from(prompts).where(eq(prompts.id, promptIdFilter))
    : await db.select().from(prompts).where(eq(prompts.isActive, true));

  if (activePrompts.length === 0) {
    return NextResponse.json({ ok: true, dispatched: 0, note: "No matching prompts" });
  }

  const runDate = new Date().toISOString();
  const jobs: PipelineJob[] = [];
  for (const p of activePrompts) {
    for (const engine of engines) {
      jobs.push({ workspaceId: p.workspaceId, promptId: p.id, engine, runDate, query: p.query });
    }
  }

  console.log(
    `[run-daily-scan] Starting ${jobs.length} jobs — ${activePrompts.length} prompts × ${engines.length} engines`,
  );

  void runPipelineForAllEngines(jobs).catch((err) => {
    console.error("[run-daily-scan] pipeline error:", err);
  });

  return NextResponse.json({
    ok: true,
    dispatched: jobs.length,
    prompts: activePrompts.length,
    engines,
  });
}

export { handler as GET, handler as POST };
