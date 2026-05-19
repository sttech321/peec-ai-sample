import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "../../../../db";
import { magicLinkTokens } from "../../../../db/schema";
import { sendMagicLinkEmail, isSmtpConfigured } from "../../../../lib/send-email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string };

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const token = randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await db.insert(magicLinkTokens).values({
      email: email.toLowerCase().trim(),
      token,
      expiresAt,
    });

    const magicUrl = `${APP_URL}/api/auth/verify?token=${token}`;

    await sendMagicLinkEmail(email, magicUrl);

    return NextResponse.json({
      ok: true,
      // In dev mode (no SMTP), expose the link so it can be shown on screen
      devLink: isSmtpConfigured ? undefined : magicUrl,
    });
  } catch (err) {
    console.error("magic-link error:", err);
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 });
  }
}
