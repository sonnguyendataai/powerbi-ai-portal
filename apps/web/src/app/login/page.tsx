"use client";

import { useEffect, useState } from "react";
import { Alert, BrandLogo } from "@/components/ui";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [externalError, setExternalError] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("error") ?? "";
    setExternalError(value);
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
        setError(json.error ?? "Login failed");
        return;
      }
      window.location.href = `/t/${json.user?.tenantId ?? "tenant-default"}/dashboard`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <BrandLogo />
        <div>
          <div className="eyebrow">Enterprise analytics portal</div>
          <h1 className="page-title">Empowering insights, transforming futures.</h1>
          <p className="page-description">
            Centralize Power BI content, AI-assisted analytics, governed data workflows,
            and administration in one modern portal.
          </p>
        </div>
        <div className="badge">Secure SSO + local identity</div>
      </section>
      <section className="login-form-wrap">
        <div className="login-card card">
          <h2 style={{ marginTop: 0 }}>Welcome back</h2>
          <p className="muted">Sign in with local credentials or Microsoft AD SSO.</p>
          <div className="stack">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
          <button disabled={busy || !username || !password} onClick={() => void loginLocal()}>
            {busy ? "Signing in..." : "Sign in with username/password"}
          </button>
          <a className="button secondary" href="/api/auth/sso/start">Continue with Microsoft AD</a>
        </div>
          {error ? <Alert>{error}</Alert> : null}
          {externalError ? <Alert>SSO error: {externalError}</Alert> : null}
        </div>
      </section>
    </main>
  );
}
