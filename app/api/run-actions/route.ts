import { NextResponse } from "next/server";
import { db } from "../../../db";
import { chats, prompts } from "../../../db/schema";
import { eq, gte } from "drizzle-orm";
import { generateActionsForProject } from "../../../lib/generate-actions";

export const runtime = "nodejs";

// Daily actions generator.
// Called by Render Cron at 8 AM UTC (2 hours after run-daily-scan):
//   GET /api/run-actions
//
// Finds all projects that have scan data from today and generates
// earned + owned content actions for each.
async function handler() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const projectsWithScans = await db
    .selectDistinct({ projectId: prompts.projectId, workspaceId: prompts.workspaceId })
    .from(chats)
    .innerJoin(prompts, eq(prompts.id, chats.promptId))
    .where(gte(chats.createdAt, todayStart));

  console.log(`[run-actions] Found ${projectsWithScans.length} projects with today's scans`);

  let generated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const { projectId, workspaceId } of projectsWithScans) {
    try {
      console.log(`[run-actions] Generating actions for project=${projectId}`);
      const result = await generateActionsForProject(projectId, workspaceId);
      if (result.skipped) {
        console.log(`[run-actions] Skipped project=${projectId} reason=${result.reason}`);
        skipped++;
      } else {
        console.log(
          `[run-actions] Done project=${projectId} earned=${result.earned} owned=${result.owned}`,
        );
        generated++;
      }
    } catch (err) {
      console.error(`[run-actions] Failed project=${projectId}:`, err);
      errors.push(projectId);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    projects: projectsWithScans.length,
    generated,
    skipped,
    ...(errors.length > 0 && { errors }),
  });
}

export { handler as GET, handler as POST };
