import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../db";
import { magicLinkTokens, projects, workspaceMembers } from "../../../../db/schema";
import { signSession, SESSION_COOKIE, SETUP_DONE_COOKIE, SESSION_MAX_AGE } from "../../../../lib/session";

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
    const [row] = await db
      .select()
      .from(magicLinkTokens)
      .where(eq(magicLinkTokens.token, token))
      .limit(1);

    if (!row) return NextResponse.redirect(new URL("/sign-in?error=invalid_token", req.url));
    if (row.used) return NextResponse.redirect(new URL("/sign-in?error=token_used", req.url));
    if (new Date() > row.expiresAt) return NextResponse.redirect(new URL("/sign-in?error=token_expired", req.url));

    // Mark token as used
    await db.update(magicLinkTokens).set({ used: true }).where(eq(magicLinkTokens.id, row.id));

    const email = row.email.toLowerCase().trim();

    // Check if this user has their own projects (owner)
    const [existingProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.workspaceId, email))
      .limit(1);

    // Check if this user is an invited workspace member
    const [membership] = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.email, email))
      .limit(1);

    let sessionPayload: { email: string; workspaceId: string; role: string };
    let destination: string;

    if (existingProject) {
      sessionPayload = { email, workspaceId: email, role: "owner" };
      destination = "/";
    } else if (membership) {
      sessionPayload = { email, workspaceId: membership.workspaceId, role: membership.role };
      destination = "/";
    } else {
      sessionPayload = { email, workspaceId: email, role: "owner" };
      destination = "/setup";
    }

    const sessionValue = signSession(sessionPayload);
    const response = NextResponse.redirect(new URL(destination, req.url));
    response.cookies.set(SESSION_COOKIE, sessionValue, COOKIE_OPTS(SESSION_MAX_AGE));

    if (destination === "/") {
      response.cookies.set(SETUP_DONE_COOKIE, "1", COOKIE_OPTS(SESSION_MAX_AGE));
    }

    return response;
  } catch (err) {
    console.error("verify error:", err);
    return NextResponse.redirect(new URL("/sign-in?error=server_error", req.url));
  }
}
