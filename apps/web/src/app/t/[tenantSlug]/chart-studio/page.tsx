"use client";

import { use, useMemo, useState } from "react";
import { Alert, Badge, EmptyState, PageHeader, Surface } from "@/components/ui";

interface ChartSpec {
  title: string;
  chartType: "bar" | "line" | "area" | "scatter" | "table";
  x: string;
  y: string;
  filters: Array<{ field: string; operator: string; values: string[] }>;
}

const CHART_ICON: Record<ChartSpec["chartType"], string> = {
  bar: "📊",
  line: "📈",
  area: "🌄",
  scatter: "✴️",
  table: "🧾",
};

const PROMPT_PRESETS = [
  "Show monthly sales trend by region",
  "Compare revenue across product categories",
  "Plot profit vs discount by customer",
];

export default function TenantChartStudioPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  use(params);
  const [prompt, setPrompt] = useState("");
  const [spec, setSpec] = useState<ChartSpec | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => prompt.trim().length > 0, [prompt]);

  async function generateChart(): Promise<void> {
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = (await res.json()) as ChartSpec & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to generate chart spec.");
        return;
      }
      setSpec(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
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
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the chart you want, e.g. 'Show monthly sales trend by region'…"
              style={{ minHeight: 160, resize: "vertical" }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void generateChart(); }}
            />
            <div className="stack-sm">
              {PROMPT_PRESETS.map((p) => (
                <button
                  key={p}
                  className="ghost"
                  onClick={() => setPrompt(p)}
                  style={{
                    justifyContent: "flex-start", textAlign: "left", padding: "8px 11px",
                    borderRadius: "var(--radius-sm)", fontSize: 12.5, color: "var(--text-soft)",
                    background: "rgba(108,142,247,0.05)", border: "1px solid var(--glass-border)",
                    boxShadow: "none", minHeight: "unset", whiteSpace: "normal", lineHeight: 1.5,
                  }}
                >{p}</button>
              ))}
            </div>
            <button onClick={() => void generateChart()} disabled={loading || !canSubmit}>
              {loading ? (
                <><span style={{ display: "inline-block", animation: "spin 0.7s linear infinite" }}>⟳</span> Generating…</>
              ) : "Generate chart spec"}
            </button>
            {error ? <Alert>{error}</Alert> : null}
          </div>
        </Surface>

        <Surface title="Generated spec">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ height: 120, borderRadius: 10, background: "linear-gradient(90deg, rgba(108,142,247,0.06) 0%, rgba(108,142,247,0.14) 50%, rgba(108,142,247,0.06) 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
              {[60, 80].map((w, i) => (
                <div key={i} style={{ height: 14, width: `${w}%`, borderRadius: 6, background: "linear-gradient(90deg, rgba(108,142,247,0.06) 0%, rgba(108,142,247,0.14) 50%, rgba(108,142,247,0.06) 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
              ))}
            </div>
          ) : spec ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 30 }}>{CHART_ICON[spec.chartType] ?? "📊"}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{spec.title}</div>
                  <Badge>{spec.chartType}</Badge>
                </div>
              </div>

              {/* Axis mapping */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(108,142,247,0.05)", border: "1px solid var(--glass-border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>X axis</div>
                  <code style={{ fontSize: 13, color: "var(--text)" }}>{spec.x}</code>
                </div>
                <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(108,142,247,0.05)", border: "1px solid var(--glass-border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Y axis</div>
                  <code style={{ fontSize: 13, color: "var(--text)" }}>{spec.y}</code>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 8 }}>
                  Filters ({spec.filters?.length ?? 0})
                </div>
                {spec.filters && spec.filters.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {spec.filters.map((f, i) => (
                      <div key={i} style={{ fontSize: 13, color: "var(--text-soft)" }}>
                        <code>{f.field}</code> <span style={{ color: "var(--text-muted)" }}>{f.operator}</span> {f.values.join(", ")}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No filters applied.</span>
                )}
              </div>
            </div>
          ) : (
            <EmptyState title="No chart spec yet" description="Generate a chart spec to inspect fields, title, and visualization type." />
          )}
        </Surface>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </section>
  );
}
