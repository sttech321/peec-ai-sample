import { NextRequest, NextResponse } from "next/server";

const COOKIE = "tv_access";

export async function POST(req: NextRequest) {
  const PASSWORD = process.env.TV_APP_PASSWORD ?? "Thrive4Life!";
  const { password, from } = await req.json();

  if (password !== PASSWORD) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const dest = (from && from.startsWith("/") && !from.startsWith("/password"))
    ? from
    : "/sign-in";

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const response = NextResponse.redirect(`${appUrl}${dest}`);
  response.cookies.set(COOKIE, PASSWORD, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return response;
}
