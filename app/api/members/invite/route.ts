import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../../../../db";
import { workspaceMembers, workspaceInvitations } from "../../../../db/schema";
import { verifySession, SESSION_COOKIE } from "../../../../lib/session";
import { canManageMembers } from "../../../../lib/permissions";
import { sendInviteEmail, isSmtpConfigured } from "../../../../lib/send-email";

export async function POST(req: NextRequest) {
  // Auth check
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  const session = raw ? verifySession(raw) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMembers(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, role } = await req.json();
  if (!email || !role) return NextResponse.json({ error: "email and role required" }, { status: 400 });

  const normalizedEmail = (email as string).toLowerCase().trim();
  const validRoles = ["company_member", "project_member", "project_viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check if already a member
  const [existing] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, session.workspaceId),
      eq(workspaceMembers.email, normalizedEmail),
    ))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "This email is already a member of your workspace" }, { status: 409 });
  }

  // Invalidate any existing pending invites for this email+workspace
  await db
    .delete(workspaceInvitations)
    .where(and(
      eq(workspaceInvitations.workspaceId, session.workspaceId),
      eq(workspaceInvitations.email, normalizedEmail),
    ));

  // Create new invitation
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(workspaceInvitations).values({
    workspaceId: session.workspaceId,
    email: normalizedEmail,
    role,
    token,
    invitedBy: session.email,
    expiresAt,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const acceptUrl = `${appUrl}/api/members/invite/accept?token=${token}`;

  await sendInviteEmail(normalizedEmail, session.email, role, acceptUrl);

  const devLink = !isSmtpConfigured ? acceptUrl : undefined;
  return NextResponse.json({ ok: true, devLink });
}
