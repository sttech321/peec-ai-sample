import { NextResponse } from "next/server";
import { db } from "../../../db";
import { prompts } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "../../../inngest/client";
import { DEFAULT_ENGINES } from "../../../lib/ai-clients";
import { runPipelineForAllEngines, type PipelineJob } from "../../../lib/run-pipeline";

export const runtime = "nodejs";

// Manual trigger for the daily prompt-crawl. Mirrors `scheduleDailyScans` in
// inngest/functions.ts but firable on-demand for testing — the 6 AM UTC cron
// is still the production source of truth.
//
// GET /api/run-daily-scan            -> all active prompts × all DEFAULT_ENGINES
// GET /api/run-daily-scan?promptId=… -> one prompt × all DEFAULT_ENGINES
// GET /api/run-daily-scan?engines=ChatGPT,Claude -> subset of engines
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
      jobs.push({
        workspaceId: p.workspaceId,
        promptId: p.id,
        engine,
        runDate,
        query: p.query,
      });
    }
  }

  // Try Inngest; fall back to inline pipeline when dev server is unreachable.
  try {
    await inngest.send(
      jobs.map((j) => ({ name: "prompt.run" as const, data: j })),
    );
    return NextResponse.json({
      ok: true,
      dispatched: jobs.length,
      mode: "inngest",
      prompts: activePrompts.length,
      engines,
    });
  } catch (err: unknown) {
    const isConnErr =
      err instanceof Error &&
      ((err as NodeJS.ErrnoException).code === "ECONNREFUSED" ||
        (err as NodeJS.ErrnoException).code === "ENOTFOUND" ||
        err.message?.includes("fetch failed"));
    if (!isConnErr) {
      return NextResponse.json(
        { ok: false, error: (err as Error)?.message ?? String(err) },
        { status: 500 },
      );
    }
    console.warn("[run-daily-scan] Inngest unreachable — running inline.");
    await runPipelineForAllEngines(jobs);
    return NextResponse.json({
      ok: true,
      dispatched: jobs.length,
      mode: "inline",
      prompts: activePrompts.length,
      engines,
    });
  }
}

export { handler as GET, handler as POST };
