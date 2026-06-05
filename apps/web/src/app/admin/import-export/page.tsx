"use client";

import { useState } from "react";
import { Alert, PageHeader, Surface } from "@/components/ui";

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
      <PageHeader eyebrow="Operations" title="Import / Export" description="Move user configuration in and out of the portal safely." actions={<button onClick={() => void exportUsers()}>Export users</button>} />
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid-2">
        <Surface title="Import payload">
          <div className="stack">
            <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} style={{ minHeight: 320 }} />
            <button onClick={() => void importUsers()}>Validate and import</button>
          </div>
        </Surface>
        <Surface title="Export result">
          <textarea value={exported} readOnly style={{ minHeight: 380 }} />
        </Surface>
      </div>
    </section>
  );
}
