import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../db";
import { magicLinkTokens, projects, workspaceMembers } from "../../../../db/schema";
import { signSession, SESSION_COOKIE, SETUP_DONE_COOKIE, SESSION_MAX_AGE } from "../../../../lib/session";
import { upsertUser } from "../../../../lib/upsert-user";

const COOKIE_OPTS = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge,
  path: "/",
});

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(`${baseUrl()}/sign-in?error=missing_token`);

  try {
    const [row] = await db
      .select()
      .from(magicLinkTokens)
      .where(eq(magicLinkTokens.token, token))
      .limit(1);

    if (!row) return NextResponse.redirect(`${baseUrl()}/sign-in?error=invalid_token`);
    if (row.used) return NextResponse.redirect(`${baseUrl()}/sign-in?error=token_used`);
    if (new Date() > row.expiresAt) return NextResponse.redirect(`${baseUrl()}/sign-in?error=token_expired`);

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
    const [firstProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .limit(1);

    let finalWorkspaceId = workspaceId;
    let finalRole = "owner";
    let destination = "/setup";

    if (firstProject) {
      // User has their own projects → always log into own workspace
      destination = "/";
    } else if (membership) {
      // User has NO own projects but is invited member of another workspace
      // (pure guest user — no personal account setup yet)
      finalWorkspaceId = membership.workspaceId;
      finalRole = membership.role;
      destination = "/";
    }
    // else: new user with no projects and no membership → /setup

    const sessionValue = signSession({ email, userId, workspaceId: finalWorkspaceId, role: finalRole });
    const response = NextResponse.redirect(`${baseUrl()}${destination}`);
    response.cookies.set(SESSION_COOKIE, sessionValue, COOKIE_OPTS(SESSION_MAX_AGE));
    if (destination === "/") {
      response.cookies.set(SETUP_DONE_COOKIE, "1", COOKIE_OPTS(SESSION_MAX_AGE));
    }
    return response;
  } catch (err) {
    console.error("verify error:", err);
    return NextResponse.redirect(`${baseUrl()}/sign-in?error=server_error`);
  }
}
