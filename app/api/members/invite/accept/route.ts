import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "../../../../../db";
import { workspaceInvitations, workspaceMembers } from "../../../../../db/schema";
import { signSession, SESSION_COOKIE, SETUP_DONE_COOKIE, SESSION_MAX_AGE } from "../../../../../lib/session";

const COOKIE_OPTS = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge,
  path: "/",
});

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/sign-in?error=missing_token", req.url));
  }

  try {
    const [invite] = await db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.token, token))
      .limit(1);

    if (!invite) return NextResponse.redirect(new URL("/sign-in?error=invalid_invite", req.url));
    if (invite.used) return NextResponse.redirect(new URL("/sign-in?error=invite_used", req.url));
    if (new Date() > invite.expiresAt) return NextResponse.redirect(new URL("/sign-in?error=invite_expired", req.url));

    // Mark invitation as used
    await db.update(workspaceInvitations).set({ used: true }).where(eq(workspaceInvitations.id, invite.id));

    // Upsert workspace member (insert or update role if re-invited)
    const [existingMember] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, invite.workspaceId),
        eq(workspaceMembers.email, invite.email),
      ))
      .limit(1);

    if (existingMember) {
      await db
        .update(workspaceMembers)
        .set({ role: invite.role })
        .where(eq(workspaceMembers.id, existingMember.id));
    } else {
      await db.insert(workspaceMembers).values({
        workspaceId: invite.workspaceId,
        email: invite.email,
        role: invite.role,
        invitedBy: invite.invitedBy,
      });
    }

    const sessionPayload = {
      email: invite.email,
      workspaceId: invite.workspaceId,
      role: invite.role,
    };

    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set(SESSION_COOKIE, signSession(sessionPayload), COOKIE_OPTS(SESSION_MAX_AGE));
    response.cookies.set(SETUP_DONE_COOKIE, "1", COOKIE_OPTS(SESSION_MAX_AGE));
    return response;
  } catch (err) {
    console.error("invite accept error:", err);
    return NextResponse.redirect(new URL("/sign-in?error=server_error", req.url));
  }
}
