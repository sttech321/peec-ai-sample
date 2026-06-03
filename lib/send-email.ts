import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "noreply@thrivevision.ai";
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587", 10);

const isSmtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

export async function sendMagicLinkEmail(email: string, magicUrl: string): Promise<void> {
  if (!isSmtpConfigured) {
    // Dev mode — just log, the API will return the link for on-screen display
    console.log(`[MAGIC LINK] To: ${email}\nURL: ${magicUrl}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,   // true for 465 (SSL), false for 587 (STARTTLS)
    requireTLS: SMTP_PORT === 587,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: `"Thrive Vision" <${SMTP_FROM}>`,
    to: email,
    subject: "Your magic link to Thrive Vision",
    text: `Click the link below to sign in:\n\n${magicUrl}\n\nThis link expires in 15 minutes.`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <div style="margin-bottom:24px">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:#1a1a1a;border-radius:10px;color:#fff;font-size:16px;font-weight:700;letter-spacing:-0.5px;font-family:sans-serif">TV</div>
        </div>
        <h1 style="font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 8px">Sign in to Thrive Vision</h1>
        <p style="font-size:15px;color:#555;margin:0 0 28px;line-height:1.5">
          Click the button below to sign in. This link expires in <strong>15 minutes</strong>.
        </p>
        <a href="${magicUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
          ✦ Sign in to Thrive Vision
        </a>
        <p style="font-size:12px;color:#aaa;margin-top:28px">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendInviteEmail(
  email: string,
  inviterEmail: string,
  role: string,
  acceptUrl: string,
): Promise<void> {
  if (!isSmtpConfigured) {
    console.log(`[INVITE EMAIL] To: ${email}\nFrom: ${inviterEmail}\nRole: ${role}\nURL: ${acceptUrl}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    requireTLS: SMTP_PORT === 587,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const roleLabel = role === "company_member" ? "Company Member"
    : role === "project_member" ? "Project Member"
    : role === "project_viewer" ? "Project Viewer"
    : role;

  await transporter.sendMail({
    from: `"Thrive Vision" <${SMTP_FROM}>`,
    to: email,
    subject: `You've been invited to Thrive Vision`,
    text: `${inviterEmail} has invited you to join their workspace as ${roleLabel}.\n\nAccept the invitation:\n${acceptUrl}\n\nThis link expires in 7 days.`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <div style="margin-bottom:24px">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:#1a1a1a;border-radius:10px;color:#fff;font-size:16px;font-weight:700;letter-spacing:-0.5px;font-family:sans-serif">TV</div>
        </div>
        <h1 style="font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 8px">You're invited to Thrive Vision</h1>
        <p style="font-size:15px;color:#555;margin:0 0 8px;line-height:1.5">
          <strong>${inviterEmail}</strong> has invited you to join their workspace as <strong>${roleLabel}</strong>.
        </p>
        <p style="font-size:15px;color:#555;margin:0 0 28px;line-height:1.5">
          Click below to accept and get started. This link expires in <strong>7 days</strong>.
        </p>
        <a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
          Accept Invitation
        </a>
        <p style="font-size:12px;color:#aaa;margin-top:28px">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export { isSmtpConfigured };
