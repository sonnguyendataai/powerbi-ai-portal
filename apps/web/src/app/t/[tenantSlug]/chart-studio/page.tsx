"use client";

import { use, useState } from "react";

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
      <h2>Chart Studio</h2>
      <p>Convert business questions into chart specs and validate before publish.</p>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ width: "100%", minHeight: 100 }} />
      <div style={{ marginTop: 8 }}>
        <button onClick={() => void generateChart()}>Generate chart spec</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {spec ? (
        <pre style={{ marginTop: 12, background: "#101832", padding: 12, borderRadius: 8 }}>
          {JSON.stringify(spec, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
