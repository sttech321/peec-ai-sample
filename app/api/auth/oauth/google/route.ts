import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl, generateOAuthState, isGoogleConfigured } from "../../../../../lib/oauth";

export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/sign-in?error=google_not_configured", req.url));
  }

  const state = generateOAuthState();
  const authUrl = buildGoogleAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 300, // 5 minutes
    path: "/",
  });
  return response;
}
