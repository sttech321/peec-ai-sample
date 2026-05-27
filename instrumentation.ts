export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const ACTIONS_DELAY_MS = 1 * 60 * 1000; // actions run 1 minute after scan

  const runScans = async () => {
    console.log(`[cron] ${new Date().toISOString()} — Starting daily scan`);
    try {
      const { db }                    = await import("./db");
      const { prompts, projects }     = await import("./db/schema");
      const { eq, and }               = await import("drizzle-orm");
      const { DEFAULT_ENGINES }       = await import("./lib/ai-clients");
      const { runPipelineForAllEngines } = await import("./lib/run-pipeline");

      const activePrompts = await db
        .select({ id: prompts.id, workspaceId: prompts.workspaceId, query: prompts.query })
        .from(prompts)
        .innerJoin(projects, eq(prompts.projectId, projects.id))
        .where(and(eq(prompts.isActive, true), eq(projects.status, "active")));
      if (activePrompts.length === 0) {
        console.log("[cron] No active prompts — skipping scan");
        return;
      }

      const runDate = new Date().toISOString();
      const jobs = activePrompts.flatMap((p) =>
        DEFAULT_ENGINES.map((engine) => ({
          workspaceId: p.workspaceId,
          promptId: p.id,
          engine,
          runDate,
          query: p.query,
        })),
      );

      console.log(`[cron] Dispatching ${jobs.length} jobs (${activePrompts.length} prompts × ${DEFAULT_ENGINES.length} engines)`);
      await runPipelineForAllEngines(jobs);
      console.log("[cron] Daily scan complete");
    } catch (err) {
      console.error("[cron] Daily scan error:", err);
    }
  };

  const runActions = async () => {
    console.log(`[cron] ${new Date().toISOString()} — Generating daily actions`);
    try {
      const { db }                        = await import("./db");
      const { chats, prompts }            = await import("./db/schema");
      const { eq, gte }                   = await import("drizzle-orm");
      const { generateActionsForProject } = await import("./lib/generate-actions");

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const projectsWithScans = await db
        .selectDistinct({ projectId: prompts.projectId, workspaceId: prompts.workspaceId })
        .from(chats)
        .innerJoin(prompts, eq(prompts.id, chats.promptId))
        .where(gte(chats.createdAt, todayStart));

      console.log(`[cron] Found ${projectsWithScans.length} projects with today's scans`);

      for (const { projectId, workspaceId } of projectsWithScans) {
        try {
          const result = await generateActionsForProject(projectId, workspaceId);
          if (result.skipped) {
            console.log(`[cron] Actions skipped project=${projectId} reason=${result.reason}`);
          } else {
            console.log(`[cron] Actions done project=${projectId} earned=${result.earned} owned=${result.owned}`);
          }
        } catch (err) {
          console.error(`[cron] Actions failed project=${projectId}:`, err);
        }
      }
    } catch (err) {
      console.error("[cron] Actions generation error:", err);
    }
  };

  const runCycle = async () => {
    await runScans();
    setTimeout(() => { void runActions(); }, ACTIONS_DELAY_MS);
  };

  // Daily at 6 AM UTC, repeat every 24 hours
  const msUntilNext6amUtc = () => {
    const now = new Date();
    const next = new Date();
    next.setUTCHours(6, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  };

  const delay = msUntilNext6amUtc();
  console.log(`[cron] Next scan scheduled at 6 AM UTC (in ${Math.round(delay / 60000)} min)`);
  setTimeout(async () => {
    await runCycle();
    setInterval(() => { void runCycle(); }, 24 * 60 * 60 * 1000);
  }, delay);
}
