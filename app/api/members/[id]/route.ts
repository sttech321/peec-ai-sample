import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "../../../../db";
import { workspaceMembers } from "../../../../db/schema";
import { verifySession, SESSION_COOKIE } from "../../../../lib/session";
import { canManageMembers } from "../../../../lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  const session = raw ? verifySession(raw) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMembers(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { role } = await req.json();
  const validRoles = ["company_member", "project_member", "project_viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.id, id), eq(workspaceMembers.workspaceId, session.workspaceId)))
    .limit(1);

  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(workspaceMembers).set({ role }).where(eq(workspaceMembers.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  const session = raw ? verifySession(raw) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMembers(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.id, id), eq(workspaceMembers.workspaceId, session.workspaceId)))
    .limit(1);

  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(workspaceMembers).where(eq(workspaceMembers.id, id));
  return NextResponse.json({ ok: true });
}
