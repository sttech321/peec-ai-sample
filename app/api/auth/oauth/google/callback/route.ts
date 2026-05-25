import { NextRequest, NextResponse } from "next/server";
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

    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set(SESSION_COOKIE, signSession({ email, userId, workspaceId, role: "owner" }), COOKIE_OPTS(SESSION_MAX_AGE));
    response.cookies.set(SETUP_DONE_COOKIE, "1", COOKIE_OPTS(SESSION_MAX_AGE));
    response.cookies.delete("oauth_state");
    return response;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", req.url));
  }
}
