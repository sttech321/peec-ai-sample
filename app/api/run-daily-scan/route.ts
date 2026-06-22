import { NextResponse } from "next/server";
import { db } from "../../../db";
import { prompts, projects } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_ENGINES } from "../../../lib/ai-clients";
import { runPipelineForAllEngines, type PipelineJob } from "../../../lib/run-pipeline";
import { timezoneForCountryName } from "../../../lib/setup-types";

export const runtime = "nodejs";

type ScanPrompt = { id: string; workspaceId: string; query: string };

/** Current hour-of-day (0-23) in the given IANA time zone, or -1 if invalid. */
function hourInTimezone(tz: string, when: Date): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(when);
    const n = parseInt(h, 10);
    return Number.isNaN(n) ? -1 : n % 24;
  } catch {
    return -1;
  }
}

// Daily prompt-crawl trigger.
// Called by Render Cron: GET /api/run-daily-scan
//
// GET /api/run-daily-scan            → all active prompts × all DEFAULT_ENGINES
// GET /api/run-daily-scan?promptId=… → one prompt × all DEFAULT_ENGINES
// GET /api/run-daily-scan?engines=ChatGPT,Claude → subset of engines
//
// Per-project local-time scheduling (opt-in — existing UTC behaviour is the
// default and unchanged):
// GET /api/run-daily-scan?byTimezone=1            → only crawl projects whose
//     local time is currently 6 AM (in the project's saved time zone)
// GET /api/run-daily-scan?byTimezone=1&localHour=9 → use a different local hour
// To use it, point the cron at this URL HOURLY so each project is caught at its
// own local hour (e.g. India 6 AM IST, Australia 6 AM AEST).
async function handler(req: Request) {
  const url = new URL(req.url);
  const promptIdFilter = url.searchParams.get("promptId");
  const enginesParam = url.searchParams.get("engines");
  const byTimezone = url.searchParams.has("byTimezone");
  const localHour = Number(url.searchParams.get("localHour") ?? "6");
  const engines = enginesParam
    ? enginesParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_ENGINES];

  let activePrompts: ScanPrompt[];

  if (promptIdFilter) {
    activePrompts = await db
      .select({ id: prompts.id, workspaceId: prompts.workspaceId, query: prompts.query })
      .from(prompts)
      .where(eq(prompts.id, promptIdFilter));
  } else if (byTimezone) {
    // Join the project so each prompt carries its project's time zone, then keep
    // only the prompts whose project is currently at `localHour` local time.
    const rows = await db
      .select({
        id: prompts.id,
        workspaceId: prompts.workspaceId,
        query: prompts.query,
        timezone: projects.timezone,
        location: projects.location,
      })
      .from(prompts)
      .innerJoin(projects, eq(prompts.projectId, projects.id))
      .where(eq(prompts.isActive, true));
    const now = new Date();
    activePrompts = rows
      .filter((r) => {
        // Prefer the explicitly stored timezone; fall back to the timezone
        // derived from the project's country (via countries-list) so that
        // every country is handled correctly even when timezone was never set.
        const tz = r.timezone
          || timezoneForCountryName(r.location ?? "")
          || "America/New_York";
        return hourInTimezone(tz, now) === localHour;
      })
      .map((r) => ({ id: r.id, workspaceId: r.workspaceId, query: r.query }));
  } else {
    activePrompts = await db
      .select({ id: prompts.id, workspaceId: prompts.workspaceId, query: prompts.query })
      .from(prompts)
      .where(eq(prompts.isActive, true));
  }

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
    `[run-daily-scan] Starting ${jobs.length} jobs — ${activePrompts.length} prompts × ${engines.length} engines${byTimezone ? ` (byTimezone, localHour=${localHour})` : ""}`,
  );

  void runPipelineForAllEngines(jobs).catch((err) => {
    console.error("[run-daily-scan] pipeline error:", err);
  });

  return NextResponse.json({
    ok: true,
    dispatched: jobs.length,
    prompts: activePrompts.length,
    engines,
    ...(byTimezone ? { mode: "byTimezone", localHour } : {}),
  });
}

export { handler as GET, handler as POST };
