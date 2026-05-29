"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PasswordForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/sign-in";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, from }),
      });
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Incorrect password.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f5f5f5",
      fontFamily: "var(--font-geist-sans), sans-serif",
    }}>
      <div style={{
        background: "#fff",
        border: "1px solid #e8e8e8",
        borderRadius: 16,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 380,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <ThriveIcon />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px", textAlign: "center" }}>
          Thrive Vision
        </h1>
        <p style={{ fontSize: 14, color: "#888", margin: "0 0 28px", textAlign: "center" }}>
          Enter your password to continue
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                border: "1px solid #d8d8d8",
                borderRadius: 8,
                outline: "none",
                boxSizing: "border-box",
                color: "#1a1a1a",
                background: "#fafafa",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              color: "#dc2626",
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: "100%",
              padding: "11px",
              background: loading ? "#555" : "#1a1a1a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Checking…" : "Continue →"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ThriveIcon() {
  return (
    <div style={{
      width: 44,
      height: 44,
      background: "#1a1a1a",
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: "-0.5px",
    }}>
      TV
    </div>
  );
}

export default function PasswordPage() {
  return (
    <Suspense>
      <PasswordForm />
    </Suspense>
  );
}
