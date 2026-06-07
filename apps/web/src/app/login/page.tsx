"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [externalError, setExternalError] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("error") ?? "";
    const labels: Record<string, string> = {
      authentication_required: "You must be signed in to access that page.",
      tenant_mismatch: "You don't have access to that workspace.",
      tenant_required: "No workspace found in your session.",
      sso_state_invalid: "SSO verification failed. Please try again.",
      sso_not_configured: "Microsoft SSO is not configured.",
      sso_failed: "Microsoft sign-in failed. Please try again.",
    };
    setExternalError(labels[value] ?? (value ? `Auth error: ${value}` : ""));
  }, []);

  async function loginLocal(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json() as { error?: string; user?: { tenantId: string } };
      if (!res.ok) {
        setError(json.error ?? "Login failed. Please check your credentials.");
        return;
      }
      window.location.href = `/t/${json.user?.tenantId ?? "tenant-default"}/dashboard`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      {/* Left brand panel */}
      <section className="login-brand">
        <div className="login-brand-top">
          <Image
            src="/brand/logodatamind.png"
            alt="DataMind"
            width={160}
            height={46}
            priority
            style={{ objectFit: "contain", height: "auto" }}
          />
        </div>

        <div className="login-brand-center">
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Enterprise analytics portal</div>
            <h1 className="login-brand-headline">
              Empowering insights,<br />transforming futures.
            </h1>
            <p className="login-brand-sub" style={{ marginTop: 16 }}>
              Centralize Power BI content, AI-assisted analytics, governed data workflows,
              and administration in one modern portal.
            </p>
          </div>

          <div className="feature-list">
            {[
              { icon: "📊", text: "Synced Power BI reports with live metadata" },
              { icon: "🤖", text: "Evidence-aware AI analyst powered by Claude" },
              { icon: "🔐", text: "RBAC governance with tenant isolation" },
              { icon: "⚡", text: "One-click chart generation and data prep" },
            ].map((f) => (
              <div className="feature-item" key={f.text}>
                <div className="feature-icon">{f.icon}</div>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="login-brand-bottom">
          <span className="badge">Secure SSO + local identity</span>
        </div>
      </section>

      {/* Right form panel */}
      <section className="login-form-wrap">
        <div className="login-card">
          <div style={{ marginBottom: 28 }}>
            <h2 className="login-card-title">Welcome back</h2>
            <p className="login-card-sub">Sign in to your workspace</p>
          </div>

          {(error || externalError) ? (
            <div style={{ marginBottom: 18 }}>
              <Alert>{error || externalError}</Alert>
            </div>
          ) : null}

          <div className="stack">
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your@username"
                autoComplete="username"
                onKeyDown={(e) => e.key === "Enter" && !busy && username && password && void loginLocal()}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••••"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && !busy && username && password && void loginLocal()}
              />
            </div>
            <button
              disabled={busy || !username || !password}
              onClick={() => void loginLocal()}
              style={{ marginTop: 4 }}
            >
              {busy ? (
                <>
                  <span style={{ display: "inline-block", animation: "spin 0.7s linear infinite" }}>⟳</span>
                  Signing in…
                </>
              ) : "Sign in"}
            </button>

            <div className="login-divider">or</div>

            <a className="sso-button" href="/api/auth/sso/start">
              <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Continue with Microsoft AD
            </a>
          </div>

          <p style={{ marginTop: 24, fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>
            Secure access is protected by HMAC-signed sessions and optional PKCE OAuth.
          </p>
        </div>
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </main>
  );
}
