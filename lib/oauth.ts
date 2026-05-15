import { randomBytes } from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
export const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID ?? "";
export const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET ?? "";

export function isGoogleConfigured() {
  return GOOGLE_CLIENT_ID.length > 10 && GOOGLE_CLIENT_SECRET.length > 5;
}

export function isMicrosoftConfigured() {
  return MICROSOFT_CLIENT_ID.length > 10 && MICROSOFT_CLIENT_SECRET.length > 5;
}

export function generateOAuthState(): string {
  return randomBytes(32).toString("hex");
}

export function googleRedirectUri() {
  return `${APP_URL}/api/auth/oauth/google/callback`;
}

export function microsoftRedirectUri() {
  return `${APP_URL}/api/auth/oauth/microsoft/callback`;
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function buildMicrosoftAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    redirect_uri: microsoftRedirectUri(),
    response_type: "code",
    scope: "openid email profile User.Read",
    state,
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{ email: string; name?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const tokens = await res.json();

  if (!tokens.id_token) throw new Error("No id_token in Google response");

  // Decode JWT payload (no library needed — it's just base64url)
  const [, payloadB64] = tokens.id_token.split(".");
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

  if (!payload.email) throw new Error("No email in Google id_token");
  return { email: payload.email as string, name: payload.name as string | undefined };
}

export async function exchangeMicrosoftCode(code: string): Promise<{ email: string; name?: string }> {
  const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      redirect_uri: microsoftRedirectUri(),
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Microsoft token exchange failed: ${err}`);
  }

  const tokens = await tokenRes.json();
  const accessToken: string = tokens.access_token;

  // Fetch user profile from Microsoft Graph
  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!meRes.ok) throw new Error("Failed to fetch Microsoft user profile");

  const me = await meRes.json();
  const email: string = me.mail ?? me.userPrincipalName;
  if (!email) throw new Error("No email in Microsoft profile");

  return { email: email.toLowerCase().trim(), name: me.displayName };
}
