import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../../../db";
import { projects, workspaceMembers } from "../../../../../../db/schema";
import { signSession, SESSION_COOKIE, SETUP_DONE_COOKIE, SESSION_MAX_AGE } from "../../../../../../lib/session";
import { exchangeGoogleCode } from "../../../../../../lib/oauth";

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
  const errorParam = searchParams.get("error");

  // User denied consent
  if (errorParam) {
    return NextResponse.redirect(new URL("/sign-in?error=oauth_denied", req.url));
  }

  // CSRF check
  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_state", req.url));
  }

  try {
    const { email: rawEmail } = await exchangeGoogleCode(code);
    const email = rawEmail.toLowerCase().trim();

    // Resolve workspace + role (same logic as magic-link verify)
    const [existingProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.workspaceId, email))
      .limit(1);

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

    const response = NextResponse.redirect(new URL(destination, req.url));
    response.cookies.set(SESSION_COOKIE, signSession(sessionPayload), COOKIE_OPTS(SESSION_MAX_AGE));
    if (destination === "/") {
      response.cookies.set(SETUP_DONE_COOKIE, "1", COOKIE_OPTS(SESSION_MAX_AGE));
    }
    // Clear the CSRF state cookie
    response.cookies.delete("oauth_state");
    return response;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", req.url));
  }
}
