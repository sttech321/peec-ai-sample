import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SETUP_DONE_COOKIE } from "../../../../lib/session";

export async function POST(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/landing", req.url));
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(SETUP_DONE_COOKIE);
  return response;
}
