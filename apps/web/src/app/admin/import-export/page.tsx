"use client";

import { useState } from "react";

export default function AdminImportExportPage() {
  const [jsonText, setJsonText] = useState("[]");
  const [exported, setExported] = useState("[]");
  const [error, setError] = useState("");

  async function exportUsers(): Promise<void> {
    const res = await fetch("/api/admin/import-export");
    const json = await res.json() as { exportedUsers?: unknown; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Export failed");
      return;
    }
    setError("");
    setExported(JSON.stringify(json.exportedUsers ?? [], null, 2));
  }

  async function importUsers(): Promise<void> {
    const payload = JSON.parse(jsonText) as unknown;
    const res = await fetch("/api/admin/import-export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json() as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Import failed");
      return;
    }
    setError("");
  }

  return (
    <section>
      <h2>Import / Export Users</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={() => void exportUsers()}>Export</button>
        <button onClick={() => void importUsers()}>Import</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} style={{ minHeight: 220 }} />
        <textarea value={exported} readOnly style={{ minHeight: 220 }} />
      </div>
    </section>
  );
}
