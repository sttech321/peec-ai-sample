import { NextResponse, NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { verifySession, SESSION_COOKIE, SETUP_DONE_COOKIE } from "./lib/session";

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const isClerkConfigured =
  CLERK_KEY.startsWith("pk_") &&
  CLERK_KEY.length > 40 &&
  !CLERK_KEY.includes("dummy");

const TV_PASSWORD = process.env.TV_APP_PASSWORD ?? "Thrive4Life!";
const TV_COOKIE = "tv_access";

const isPublicRoute = createRouteMatcher([
  '/landing(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/password(.*)',
  '/api/inngest(.*)',
  '/api/auth(.*)',
  '/api/members/invite/accept(.*)',
]);

const isSetupRoute = createRouteMatcher(['/setup(.*)']);
const isUnauthorizedRoute = createRouteMatcher(['/unauthorized(.*)']);

// Owner-only routes — non-owners get redirected to /unauthorized
const isOwnerOnlyRoute = createRouteMatcher([
  '/settings(.*)',
  '/api-keys(.*)',
]);

// Owner + company_member routes
const isMemberManageRoute = createRouteMatcher([
  '/members(.*)',
]);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL('/landing', req.url));
  }
});

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Password gate — runs first, before auth ──────────────────────
  const isPasswordRoute = pathname.startsWith('/password') || pathname.startsWith('/api/auth/password');
  const isStaticAsset = pathname.startsWith('/_next') || pathname.startsWith('/favicon');
  // Exempt magic link + invite accept from password gate so email links always work
  const isMagicLinkRoute = pathname.startsWith('/api/auth/verify') || pathname.startsWith('/api/members/invite/accept');

  if (!isPasswordRoute && !isStaticAsset && !isMagicLinkRoute) {
    const tvCookie = req.cookies.get(TV_COOKIE)?.value;
    if (tvCookie !== TV_PASSWORD) {
      const url = req.nextUrl.clone();
      // Include full path + query string so tokens survive the redirect
      const fullPath = pathname + req.nextUrl.search;
      url.pathname = '/password';
      url.search = `?from=${encodeURIComponent(fullPath)}`;
      return NextResponse.redirect(url);
    }
  }

  // ── Clerk mode ───────────────────────────────────────────────────
  if (isClerkConfigured) {
    return (clerkHandler as any)(req);
  }

  // ── Custom session mode ──────────────────────────────────────────

  // Public routes — always allow
  if (isPublicRoute(req)) return NextResponse.next();

  // Verify session cookie
  const rawSession = req.cookies.get(SESSION_COOKIE)?.value;
  const user = rawSession ? verifySession(rawSession) : null;

  if (!user) {
    // Not logged in at root → sign-in page (not landing)
    if (pathname === '/') return NextResponse.redirect(new URL('/sign-in', req.url));
    // Not logged in elsewhere → landing
    return NextResponse.redirect(new URL('/landing', req.url));
  }

  // Logged in but setup not done → force to /setup (except /setup itself)
  const setupDone = req.cookies.get(SETUP_DONE_COOKIE)?.value;
  if (!setupDone && !isSetupRoute(req)) {
    return NextResponse.redirect(new URL('/setup', req.url));
  }

  // ── Role-based route protection ──────────────────────────────────
  const userRole = user.role ?? "project_viewer";
  const isUnauthorized = isUnauthorizedRoute(req);

  // Owner-only routes
  if (!isUnauthorized && isOwnerOnlyRoute(req) && userRole !== "owner") {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // Members manage: owner + company_member only
  if (!isUnauthorized && isMemberManageRoute(req) &&
    userRole !== "owner" && userRole !== "company_member") {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
