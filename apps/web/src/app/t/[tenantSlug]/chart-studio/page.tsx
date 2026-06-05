"use client";

import { use, useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

interface ChartResponse {
  chartType: string;
  xField: string;
  yField: string;
  title: string;
}

export default function TenantChartStudioPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  use(params);
  const [prompt, setPrompt] = useState("Show monthly sales trend by region");
  const [spec, setSpec] = useState<ChartResponse | null>(null);
  const [error, setError] = useState("");

  async function generateChart(): Promise<void> {
    setError("");
    const res = await fetch("/api/chart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });
    const json = (await res.json()) as ChartResponse & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to generate chart spec.");
      return;
    }
    setSpec(json);
  }

  return (
    <section>
      <PageHeader
        eyebrow="Visual analytics"
        title="Chart Studio"
        description="Turn business questions into chart specifications and review the generated structure before publishing."
      />
      <div className="workspace-layout">
        <Surface title="Prompt">
          <div className="stack">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ minHeight: 180 }} />
            <button onClick={() => void generateChart()}>Generate chart spec</button>
            {error ? <Alert>{error}</Alert> : null}
          </div>
        </Surface>
        <Surface title="Generated spec">
          {spec ? (
            <pre>{JSON.stringify(spec, null, 2)}</pre>
          ) : (
            <EmptyState title="No chart spec yet" description="Generate a chart spec to inspect fields, title, and visualization type." />
          )}
        </Surface>
      </div>
    </section>
  );
}
