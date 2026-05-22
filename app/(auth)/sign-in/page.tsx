"use client";

import { useState, useEffect, Suspense } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const isClerkEnabled =
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_") &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").length > 40 &&
  !(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").includes("dummy");

export default function SignInPage() {
  return (
    <Suspense>
      {isClerkEnabled ? <SignInWithClerk /> : <SignInCustom />}
    </Suspense>
  );
}

/* ── Real Clerk sign-in ── */
function SignInWithClerk() {
  const signInHook = useSignIn() as any;
  const { isLoaded, signIn } = signInHook ?? {};
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = async (strategy: "oauth_google" | "oauth_microsoft") => {
    if (!isLoaded) return;
    try {
      await signIn.authenticateWithRedirect({ strategy, redirectUrl: "/sign-in/sso-callback", redirectUrlComplete: "/" });
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "OAuth failed.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const si = await signIn.create({ identifier: email.trim() });
      const factor = si.supportedFirstFactors?.find((f: any) => f.strategy === "email_link");
      if (factor) {
        const { startMagicLinkFlow } = signIn.createMagicLinkFlow();
        setSent(true);
        startMagicLinkFlow({ emailAddressId: factor.emailAddressId, redirectUrlComplete: `${window.location.origin}/` }).catch(() => {});
      } else {
        setError("Magic link unavailable. Use OAuth.");
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message ?? "";
      setError(msg.toLowerCase().includes("not found") ? "No account found. Sign up first." : msg || "Failed.");
    } finally {
      setLoading(false);
    }
  };

  return <SignInUI email={email} loading={loading} error={error} sent={sent} devLink={null}
    onEmailChange={setEmail} onSubmit={handleSubmit} onOAuth={handleOAuth} onReset={() => setSent(false)} />;
}

/* ── Custom magic link sign-in (no Clerk) ── */
function SignInCustom() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  // Show errors passed back from OAuth callbacks
  useEffect(() => {
    const err = searchParams.get("error");
    if (!err) return;
    const msgs: Record<string, string> = {
      google_not_configured: "Google sign-in is not configured yet. Use email magic link below.",
      microsoft_not_configured: "Microsoft sign-in is not configured yet. Use email magic link below.",
      oauth_denied: "You cancelled the sign-in. Try again.",
      invalid_state: "Sign-in session expired. Please try again.",
      oauth_failed: "Sign-in failed. Please try again or use the magic link.",
    };
    setError(msgs[err] ?? "Something went wrong. Please try again.");
  }, [searchParams]);

  const handleOAuth = (strategy: "oauth_google" | "oauth_microsoft") => {
    setError(null);
    if (strategy === "oauth_google") {
      window.location.href = "/api/auth/oauth/google";
    } else {
      window.location.href = "/api/auth/oauth/microsoft";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to send magic link."); return; }
      sessionStorage.setItem("peec_auth_email", email.trim());
      setDevLink(data.devLink ?? null);
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return <SignInUI email={email} loading={loading} error={error} sent={sent} devLink={devLink}
    onEmailChange={setEmail} onSubmit={handleSubmit} onOAuth={handleOAuth} onReset={() => { setSent(false); setDevLink(null); }} />;
}

/* ── Shared UI ── */
function SignInUI({ email, loading, error, sent, devLink, onEmailChange, onSubmit, onOAuth, onReset }: {
  email: string; loading: boolean; error: string | null; sent: boolean; devLink: string | null;
  onEmailChange: (v: string) => void; onSubmit: (e: React.FormEvent) => void;
  onOAuth: (s: "oauth_google" | "oauth_microsoft") => void; onReset: () => void;
}) {
  return (
    <div className="su-wrap">
      <div className="su-logo"><PeecIcon /></div>
      <h1 className="su-title">Log in</h1>
      <p className="su-sub">Log in using Google or Microsoft.</p>

      <div className="su-oauth">
        <button className="su-oauth-btn" onClick={() => onOAuth("oauth_google")}><GoogleIcon /> Log in with Google</button>
        <button className="su-oauth-btn" onClick={() => onOAuth("oauth_microsoft")}><MicrosoftIcon /> Log in with Microsoft</button>
        <button className="su-oauth-btn su-oauth-btn--sso" onClick={() => onOAuth("oauth_google")}>Log in with SSO</button>
      </div>

      <p className="su-divider">Or continue with</p>

      {sent ? (
        <div>
          <div className="auth-verify-icon">✉️</div>
          <p className="auth-verify-title" style={{ fontSize: 16 }}>Check your inbox</p>
          <p className="auth-verify-body">Magic link sent to <span className="auth-verify-email">{email}</span>.</p>
          {devLink && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#15803d", marginBottom: 6 }}>DEV MODE — Click to sign in:</p>
              <a href={devLink} style={{ fontSize: 12, color: "#15803d", wordBreak: "break-all", textDecoration: "underline" }}>{devLink}</a>
            </div>
          )}
          <button onClick={onReset}
            style={{ background: "none", border: "none", color: "#555", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            ← Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="su-form">
          <div className="su-field">
            <label className="su-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="su-input" placeholder="my@email.com"
              value={email} onChange={(e) => onEmailChange(e.target.value)} required autoComplete="email" />
            <span className="su-hint">Please use your work email address.</span>
          </div>
          {error && <div className="su-error" style={{ marginBottom: 12 }}>{error}</div>}
          <button type="submit" className="su-magic-btn" disabled={loading || !email.trim()}>
            <span className="su-magic-icon">✦</span>
            {loading ? "Sending…" : "Send Magic Link"}
          </button>
        </form>
      )}

      <p className="su-footer">
        Don&apos;t have an account? <Link href="/sign-up" prefetch={false} className="su-link">Sign up</Link>
      </p>
    </div>
  );
}

function PeecIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="2" y="2" width="10" height="10" rx="1.5" fill="#1a1a1a" />
      <rect x="16" y="2" width="10" height="10" rx="1.5" fill="#1a1a1a" />
      <rect x="2" y="16" width="10" height="10" rx="1.5" fill="#1a1a1a" />
      <rect x="16" y="16" width="10" height="10" rx="1.5" fill="#1a1a1a" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022"/>
      <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00"/>
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/>
      <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/>
    </svg>
  );
}
