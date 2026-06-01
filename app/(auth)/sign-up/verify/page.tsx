"use client";

import { useEffect, useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";

const isClerkEnabled =
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_") &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").length > 40 &&
  !(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").includes("dummy");

export default function VerifyPage() {
  return isClerkEnabled ? <VerifyWithClerk /> : <VerifyMock />;
}

function VerifyWithClerk() {
  const signUpHook = useSignUp() as any;
  const { isLoaded, signUp } = signUpHook ?? {};
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("tv_auth_email");
    if (stored) setEmail(stored);
  }, []);

  const handleResend = async () => {
    if (!isLoaded || loading || !signUp) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({
        strategy: "email_link",
        redirectUrl: `${window.location.origin}/sign-up/sso-callback`,
      });
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Failed to resend.");
    } finally {
      setLoading(false);
    }
  };

  return <VerifyUI email={email} resent={resent} loading={loading} error={error} onResend={handleResend} />;
}

function VerifyMock() {
  const [email, setEmail] = useState("");
  useEffect(() => {
    const stored = sessionStorage.getItem("tv_auth_email");
    if (stored) setEmail(stored);
  }, []);
  return <VerifyUI email={email} resent={false} loading={false} error={null} onResend={() => {}} />;
}

function VerifyUI({
  email, resent, loading, error, onResend,
}: {
  email: string;
  resent: boolean;
  loading: boolean;
  error: string | null;
  onResend: () => void;
}) {
  return (
    <div className="auth-verify-wrap">
      <div className="su-logo" style={{ marginBottom: 28 }}>
        <div style={{
          width: 44, height: 44, background: "#1a1a1a", borderRadius: 10,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 16, fontWeight: 700, letterSpacing: "-0.5px",
        }}>TV</div>
      </div>

      <div className="auth-verify-icon">✉️</div>

      <h1 className="auth-verify-title">Check your inbox</h1>
      <p className="auth-verify-body">
        We&apos;ve sent a magic link to{" "}
        {email ? <span className="auth-verify-email">{email}</span> : "your email address"}.
        {" "}Click the link to sign in — no password needed.
      </p>

      {error && <div className="auth-error" style={{ marginBottom: 12, width: "100%" }}>{error}</div>}
      {resent && <p style={{ fontSize: 12.5, color: "#16a34a", fontWeight: 500, marginBottom: 8 }}>✓ Link resent</p>}

      <p className="auth-footer-text" style={{ marginTop: 0 }}>
        <Link href="/sign-in" className="auth-footer-link">← Back to log in</Link>
      </p>

      <div className="auth-verify-resend">
        Didn&apos;t receive it?{" "}
        <button onClick={onResend} disabled={loading}>
          {loading ? "Resending…" : "Resend magic link"}
        </button>
      </div>
    </div>
  );
}
