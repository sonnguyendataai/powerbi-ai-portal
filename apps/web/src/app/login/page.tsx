"use client";

import { useEffect, useState } from "react";

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
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 460, border: "1px solid #243056", borderRadius: 12, padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Portal Sign In</h1>
        <p style={{ opacity: 0.8 }}>Sign in with local credentials or Microsoft AD SSO.</p>
        <div style={{ display: "grid", gap: 10 }}>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
          <button disabled={busy || !username || !password} onClick={() => void loginLocal()}>
            {busy ? "Signing in..." : "Sign in with username/password"}
          </button>
          <a href="/api/auth/sso/start" style={{ textAlign: "center" }}>Continue with Microsoft AD</a>
        </div>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        {externalError ? <p style={{ color: "crimson" }}>SSO error: {externalError}</p> : null}
      </section>
    </main>
  );
}
