"use client";

import { use, useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

interface PrepResponse {
  datasetId: string;
  intent: string;
  steps: Array<{ kind: string; config: Record<string, unknown> }>;
}

export default function TenantDataPrepPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  use(params);
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
      <PageHeader
        eyebrow="Data tools"
        title="Data Prep Studio"
        description="Draft transformation plans for governed datasets before execution."
      />
      <div className="workspace-layout">
        <Surface title="Transform request">
          <div className="stack">
            <input value={datasetId} onChange={(e) => setDatasetId(e.target.value)} placeholder="Dataset ID" />
            <textarea value={intent} onChange={(e) => setIntent(e.target.value)} style={{ minHeight: 160 }} />
            <button onClick={() => void generatePlan()}>Generate plan</button>
            {error ? <Alert>{error}</Alert> : null}
          </div>
        </Surface>
        <Surface title="Plan preview">
          {result ? (
            <pre>{JSON.stringify(result, null, 2)}</pre>
          ) : (
            <EmptyState title="No plan generated" description="Describe a data-prep goal to preview transformation steps." />
          )}
        </Surface>
      </div>
    </section>
  );
}
