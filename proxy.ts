import { NextResponse, NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { verifySession, SESSION_COOKIE, SETUP_DONE_COOKIE } from "./lib/session";

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const isClerkConfigured =
  CLERK_KEY.startsWith("pk_") &&
  CLERK_KEY.length > 40 &&
  !CLERK_KEY.includes("dummy");

const isPublicRoute = createRouteMatcher([
  '/landing(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/inngest(.*)',
  '/api/auth(.*)',
  '/api/members/invite/accept(.*)',
]);

const isSetupRoute = createRouteMatcher(['/setup(.*)']);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL('/landing', req.url));
  }
});

export default function middleware(req: NextRequest) {
  // ── Clerk mode ───────────────────────────────────────────────────
  if (isClerkConfigured) {
    return (clerkHandler as any)(req);
  }

  // ── Custom session mode ──────────────────────────────────────────
  const { pathname } = req.nextUrl;

  // Public routes — always allow
  if (isPublicRoute(req)) return NextResponse.next();

  // Verify session cookie
  const rawSession = req.cookies.get(SESSION_COOKIE)?.value;
  const user = rawSession ? verifySession(rawSession) : null;

  if (!user) {
    // Not logged in → landing
    return NextResponse.redirect(new URL('/landing', req.url));
  }

  // Logged in but setup not done → force to /setup (except /setup itself)
  const setupDone = req.cookies.get(SETUP_DONE_COOKIE)?.value;
  if (!setupDone && !isSetupRoute(req)) {
    return NextResponse.redirect(new URL('/setup', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
