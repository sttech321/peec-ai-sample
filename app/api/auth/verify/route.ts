import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../db";
import { magicLinkTokens, workspaces, workspaceMembers } from "../../../../db/schema";
import { signSession, SESSION_COOKIE, SETUP_DONE_COOKIE, SESSION_MAX_AGE } from "../../../../lib/session";
import { upsertUser } from "../../../../lib/upsert-user";

const COOKIE_OPTS = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge,
  path: "/",
});

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/sign-in?error=missing_token", req.url));

  try {
    const [row] = await db
      .select()
      .from(magicLinkTokens)
      .where(eq(magicLinkTokens.token, token))
      .limit(1);

    if (!row) return NextResponse.redirect(new URL("/sign-in?error=invalid_token", req.url));
    if (row.used) return NextResponse.redirect(new URL("/sign-in?error=token_used", req.url));
    if (new Date() > row.expiresAt) return NextResponse.redirect(new URL("/sign-in?error=token_expired", req.url));

    await db.update(magicLinkTokens).set({ used: true }).where(eq(magicLinkTokens.id, row.id));

    const email = row.email.toLowerCase().trim();

    // Upsert user + workspace — always resolves to UUID workspaceId
    const { userId, workspaceId } = await upsertUser({ email, provider: "magic_link", role: "owner" });

    // Check if this is a workspace member under someone else's workspace
    const [membership] = await db
      .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.email, email))
      .limit(1);

    // Check if their own workspace already has projects (returning user)
    const [ownWorkspace] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    let finalWorkspaceId = workspaceId;
    let finalRole = "owner";
    let destination = "/setup";

    if (membership) {
      finalWorkspaceId = membership.workspaceId;
      finalRole = membership.role;
      destination = "/";
    } else if (ownWorkspace) {
      destination = "/";
    }

    const sessionValue = signSession({ email, userId, workspaceId: finalWorkspaceId, role: finalRole });
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
