"use client";

import { use, useState } from "react";

interface PrepResponse {
  datasetId: string;
  intent: string;
  steps: Array<{ kind: string; config: Record<string, unknown> }>;
}

export default function TenantDataPrepPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const [datasetId, setDatasetId] = useState("dataset-sales");
  const [intent, setIntent] = useState("Normalize and aggregate sales by month");
  const [result, setResult] = useState<PrepResponse | null>(null);
  const [error, setError] = useState("");

  async function generatePlan(): Promise<void> {
    setError("");
    const res = await fetch("/api/data-prep", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantSlug,
        "x-user-id": "user@example.com",
        "x-user-roles": "analyst",
      },
      body: JSON.stringify({ datasetId, intent }),
    });
    const json = (await res.json()) as PrepResponse & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to generate plan.");
      return;
    }
    setResult(json);
  }

  return (
    <section>
      <h2>Data Prep Studio</h2>
      <p>Generate transformation plans before applying to governed datasets.</p>
      <div style={{ display: "grid", gap: 8, maxWidth: 700 }}>
        <input value={datasetId} onChange={(e) => setDatasetId(e.target.value)} placeholder="Dataset ID" />
        <textarea value={intent} onChange={(e) => setIntent(e.target.value)} style={{ minHeight: 90 }} />
        <button onClick={() => void generatePlan()}>Generate plan</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {result ? (
        <pre style={{ marginTop: 12, background: "#101832", padding: 12, borderRadius: 8 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
