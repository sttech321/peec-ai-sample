import { NextResponse } from "next/server";

// Clerk Auth is temporarily disabled until valid API keys are added to .env.local
// import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
// const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/inngest(.*)']);
// export default clerkMiddleware(async (auth, req) => {
//   if (!isPublicRoute(req)) {
//     await auth.protect();
//   }
// });

export default function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
