"use client";

import { useState, useEffect, Suspense } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const isClerkEnabled =
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_") &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").length > 40 &&
  !(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").includes("dummy");

export default function SignUpPage() {
  return (
    <Suspense>
      {isClerkEnabled ? <SignUpWithClerk /> : <SignUpCustom />}
    </Suspense>
  );
}

/* ── Real Clerk sign-up ── */
function SignUpWithClerk() {
  const signUpHook = useSignUp() as any;
  const { isLoaded, signUp } = signUpHook ?? {};
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = async (strategy: "oauth_google" | "oauth_microsoft") => {
    if (!isLoaded) return;
    setError(null);
    try {
      await signUp.authenticateWithRedirect({ strategy, redirectUrl: "/sign-up/sso-callback", redirectUrlComplete: "/" });
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "OAuth sign-up failed.");
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email.trim() });
      await signUp.prepareEmailAddressVerification({ strategy: "email_link", redirectUrl: `${window.location.origin}/sign-up/sso-callback` });
      sessionStorage.setItem("peec_auth_email", email.trim());
      router.push("/sign-up/verify");
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Failed to send magic link.");
    } finally {
      setLoading(false);
    }
  };

  return <AuthForm mode="signup" email={email} loading={loading} error={error} devLink={null}
    onEmailChange={setEmail} onSubmit={handleMagicLink} onOAuth={handleOAuth} />;
}

/* ── Custom sign-up (no Clerk) ── */
function SignUpCustom() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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

  if (sent) {
    return (
      <div className="su-wrap">
        <div className="su-logo"><PeecIcon /></div>
        <div className="auth-verify-icon">✉️</div>
        <h1 className="auth-verify-title">Check your inbox</h1>
        <p className="auth-verify-body">
          We sent a magic link to <span className="auth-verify-email">{email}</span>. Click it to sign in.
        </p>
        {devLink && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 14px", marginBottom: 16, width: "100%" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#15803d", marginBottom: 6 }}>DEV MODE — No SMTP configured. Click to sign in:</p>
            <a href={devLink} style={{ fontSize: 12, color: "#15803d", wordBreak: "break-all", textDecoration: "underline" }}>{devLink}</a>
          </div>
        )}
        <button onClick={() => { setSent(false); setDevLink(null); }}
          style={{ background: "none", border: "none", color: "#555", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
          ← Use a different email
        </button>
        <p className="su-footer" style={{ marginTop: 20 }}>
          Already have an account? <Link href="/sign-in" className="su-link">Login</Link>
        </p>
      </div>
    );
  }

  return <AuthForm mode="signup" email={email} loading={loading} error={error} devLink={null}
    onEmailChange={setEmail} onSubmit={handleSubmit} onOAuth={handleOAuth} />;
}

/* ── Shared UI ── */
function AuthForm({ mode, email, loading, error, devLink, onEmailChange, onSubmit, onOAuth }: {
  mode: "signup" | "signin";
  email: string;
  loading: boolean;
  error: string | null;
  devLink: string | null;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onOAuth: (s: "oauth_google" | "oauth_microsoft") => void;
}) {
  const isSignUp = mode === "signup";
  return (
    <div className="su-wrap">
      <div className="su-logo"><PeecIcon /></div>
      <h1 className="su-title">{isSignUp ? "Sign up" : "Log in"}</h1>
      <p className="su-sub">{isSignUp ? "Sign up" : "Log in"} using Google or Microsoft.</p>

      <div className="su-oauth">
        <button className="su-oauth-btn" onClick={() => onOAuth("oauth_google")}>
          <GoogleIcon /> {isSignUp ? "Sign up" : "Log in"} with Google
        </button>
        <button className="su-oauth-btn" onClick={() => onOAuth("oauth_microsoft")}>
          <MicrosoftIcon /> {isSignUp ? "Sign up" : "Log in"} with Microsoft
        </button>
        <button className="su-oauth-btn su-oauth-btn--sso" onClick={() => onOAuth("oauth_google")}>
          {isSignUp ? "Sign up" : "Log in"} with SSO
        </button>
      </div>

      <p className="su-divider">Or continue with</p>

      <form onSubmit={onSubmit} className="su-form">
        <div className="su-field">
          <label className="su-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="su-input" placeholder="my@email.com"
            value={email} onChange={(e) => onEmailChange(e.target.value)} required autoComplete="email" />
          <span className="su-hint">Please use your work email address.</span>
        </div>
        {error && <div className="su-error" style={{ marginBottom: 12 }}>{error}</div>}
        {devLink && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#15803d", marginBottom: 4 }}>DEV MODE</p>
            <a href={devLink} style={{ fontSize: 12, color: "#15803d", wordBreak: "break-all", textDecoration: "underline" }}>{devLink}</a>
          </div>
        )}
        <button type="submit" className="su-magic-btn" disabled={loading || !email.trim()}>
          <span className="su-magic-icon">✦</span>
          {loading ? "Sending…" : "Send Magic Link"}
        </button>
      </form>

      <p className="su-footer">
        {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="su-link">
          {isSignUp ? "Login" : "Sign up"}
        </Link>
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
