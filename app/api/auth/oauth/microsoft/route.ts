import { NextRequest, NextResponse } from "next/server";
import { buildMicrosoftAuthUrl, generateOAuthState, isMicrosoftConfigured } from "../../../../../lib/oauth";

export async function GET(req: NextRequest) {
  if (!isMicrosoftConfigured()) {
    return NextResponse.redirect(new URL("/sign-in?error=microsoft_not_configured", req.url));
  }

  const state = generateOAuthState();
  const authUrl = buildMicrosoftAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return response;
}
