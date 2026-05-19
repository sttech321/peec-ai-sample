import { NextResponse } from "next/server";
import { db } from "../../../../db";
import { earnedActions, ownedActions } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "../../../../lib/session";
import { getActiveProjectId } from "../../../../lib/project-context";
import { generateActionsForProject } from "../../../../lib/generate-actions";

export async function POST() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  let workspaceId = "unknown";
  if (raw) {
    const session = verifySession(raw);
    if (session) workspaceId = session.workspaceId;
  }

  const projectId = await getActiveProjectId();
  const result = await generateActionsForProject(projectId, workspaceId);

  if (result.skipped && result.reason === "no scan data") {
    return NextResponse.json(
      { error: "No scan data found. Run AI scans on your prompts first." },
      { status: 422 },
    );
  }

  if (result.skipped && result.reason === "already generated today") {
    return NextResponse.json({ alreadyGenerated: true, earned: result.earned });
  }

  return NextResponse.json({
    success: true,
    earned: result.earned,
    owned: result.owned,
  });
}

// Force regeneration — deletes existing actions and re-runs generation
export async function DELETE() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  let workspaceId = "unknown";
  if (raw) {
    const session = verifySession(raw);
    if (session) workspaceId = session.workspaceId;
  }

  const projectId = await getActiveProjectId();
  await db.delete(earnedActions).where(eq(earnedActions.projectId, projectId));
  await db.delete(ownedActions).where(eq(ownedActions.projectId, projectId));

  // Immediately regenerate from stored scan data
  const result = await generateActionsForProject(projectId, workspaceId);
  return NextResponse.json({ deleted: true, regenerated: result });
}
