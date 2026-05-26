import { createHmac } from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-please-set-AUTH_SECRET-in-env";
export const SESSION_COOKIE = "peec_session";
export const SETUP_DONE_COOKIE = "peec_setup_done";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  email: string;
  userId: string;      // UUID from users table
  workspaceId: string; // UUID from workspaces table
  role: string;        // owner | admin | member | viewer
}

export function signSession(data: SessionPayload): string {
  const payload = Buffer.from(JSON.stringify({ ...data, iat: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(cookie: string): SessionPayload | null {
  try {
    const dotIdx = cookie.lastIndexOf(".");
    if (dotIdx === -1) return null;
    const payload = cookie.slice(0, dotIdx);
    const sig = cookie.slice(dotIdx + 1);
    const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    // Back-compat: old sessions had { email, workspaceId (email string), role }
    return {
      email: data.email,
      userId: data.userId ?? "",
      workspaceId: data.workspaceId ?? data.email,
      role: data.role ?? "owner",
    };
  } catch {
    return null;
  }
}
