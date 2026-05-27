import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SETUP_DONE_COOKIE } from "../../../../lib/session";

export async function POST(_req: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(SETUP_DONE_COOKIE);
  return response;
}
