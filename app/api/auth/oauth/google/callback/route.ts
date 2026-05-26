import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../../../db";
import { projects, workspaceMembers } from "../../../../../../db/schema";
import { signSession, SESSION_COOKIE, SETUP_DONE_COOKIE, SESSION_MAX_AGE } from "../../../../../../lib/session";
import { exchangeGoogleCode } from "../../../../../../lib/oauth";
import { upsertUser } from "../../../../../../lib/upsert-user";

const COOKIE_OPTS = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge,
  path: "/",
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = req.cookies.get("oauth_state")?.value;

  if (searchParams.get("error")) {
    return NextResponse.redirect(new URL("/sign-in?error=oauth_denied", req.url));
  }
  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_state", req.url));
  }

  try {
    const { email: rawEmail, name } = await exchangeGoogleCode(code);
    const email = rawEmail.toLowerCase().trim();

    const { userId, workspaceId } = await upsertUser({
      email, name: name ?? undefined, provider: "google", role: "owner",
    });

    const [membership] = await db
      .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.email, email))
      .limit(1);

    const [firstProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .limit(1);

    let finalWorkspaceId = workspaceId;
    let finalRole = "owner";
    let destination = "/setup";

    if (membership) {
      finalWorkspaceId = membership.workspaceId;
      finalRole = membership.role;
      destination = "/";
    } else if (firstProject) {
      destination = "/";
    }

    const response = NextResponse.redirect(new URL(destination, req.url));
    response.cookies.set(SESSION_COOKIE, signSession({ email, userId, workspaceId: finalWorkspaceId, role: finalRole }), COOKIE_OPTS(SESSION_MAX_AGE));
    if (destination === "/") {
      response.cookies.set(SETUP_DONE_COOKIE, "1", COOKIE_OPTS(SESSION_MAX_AGE));
    }
    response.cookies.delete("oauth_state");
    return response;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", req.url));
  }
}
