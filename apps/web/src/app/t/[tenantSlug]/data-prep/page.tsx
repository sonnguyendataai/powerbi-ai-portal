"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Alert, Badge, EmptyState, PageHeader, Surface } from "@/components/ui";

interface TransformInstruction {
  type: string;
  field: string;
  replacement?: string;
}

interface PrepResponse {
  datasetId: string;
  transforms?: TransformInstruction[];
  summary?: string;
}

interface ReportItem {
  id: string;
  displayName: string;
  datasetId: string;
  workspaceId: string;
}

interface DatasetOption {
  datasetId: string;
  label: string;
  workspaceId: string;
}

const INTENT_PRESETS = [
  "Clean and standardize customer records",
  "Normalize and aggregate sales by month",
  "Replace null values with safe defaults",
];

export default function TenantDataPrepPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  use(params);
  const [datasetId, setDatasetId] = useState("");
  const [intent, setIntent] = useState("");
  const [result, setResult] = useState<PrepResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setDatasetsLoading(true);
      try {
        const res = await fetch("/api/reports");
        const json = (await res.json()) as { reports?: ReportItem[] };
        if (!res.ok) throw new Error("Failed to load datasets");
        // Reports carry the datasetId + workspaceId; dedupe to one option per dataset.
        const byDataset = new Map<string, DatasetOption>();
        for (const r of json.reports ?? []) {
          if (r.datasetId && !byDataset.has(r.datasetId)) {
            byDataset.set(r.datasetId, { datasetId: r.datasetId, label: r.displayName, workspaceId: r.workspaceId });
          }
        }
        if (!cancelled) setDatasets([...byDataset.values()]);
      } catch {
        // Non-fatal: user can still type a dataset id manually.
      } finally {
        if (!cancelled) setDatasetsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const canSubmit = useMemo(() => datasetId.trim().length > 0 && intent.trim().length > 0, [datasetId, intent]);

  async function generatePlan(): Promise<void> {
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const workspaceId = datasets.find((d) => d.datasetId === datasetId)?.workspaceId;
      const res = await fetch("/api/data-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId, intent, ...(workspaceId ? { workspaceId } : {}) }),
      });
      const json = (await res.json()) as PrepResponse & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to generate plan.");
        return;
      }
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
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
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="prep-dataset" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                Dataset
              </label>
              {datasets.length > 0 ? (
                <select id="prep-dataset" value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
                  <option value="">{datasetsLoading ? "Loading datasets…" : "Select a dataset"}</option>
                  {datasets.map((d) => (
                    <option key={d.datasetId} value={d.datasetId}>{d.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="prep-dataset"
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  placeholder={datasetsLoading ? "Loading datasets…" : "Dataset ID (no synced datasets found)"}
                />
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="prep-intent" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                Transformation goal
              </label>
              <textarea
                id="prep-intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="Describe what you want to do with this dataset…"
                style={{ minHeight: 140, resize: "vertical" }}
              />
            </div>

            <div className="stack-sm">
              {INTENT_PRESETS.map((p) => (
                <button
                  key={p}
                  className="ghost"
                  onClick={() => setIntent(p)}
                  style={{
                    justifyContent: "flex-start", textAlign: "left", padding: "8px 11px",
                    borderRadius: "var(--radius-sm)", fontSize: 12.5, color: "var(--text-soft)",
                    background: "rgba(108,142,247,0.05)", border: "1px solid var(--glass-border)",
                    boxShadow: "none", minHeight: "unset", whiteSpace: "normal", lineHeight: 1.5,
                  }}
                >{p}</button>
              ))}
            </div>

            <button onClick={() => void generatePlan()} disabled={loading || !canSubmit}>
              {loading ? (
                <><span style={{ display: "inline-block", animation: "spin 0.7s linear infinite" }}>⟳</span> Generating…</>
              ) : "Generate plan"}
            </button>
            {error ? <Alert>{error}</Alert> : null}
          </div>
        </Surface>

        <Surface title="Plan preview">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[70, 90, 60].map((w, i) => (
                <div key={i} style={{
                  height: 40, width: `${w}%`, borderRadius: 8,
                  background: "linear-gradient(90deg, rgba(108,142,247,0.06) 0%, rgba(108,142,247,0.14) 50%, rgba(108,142,247,0.06) 100%)",
                  backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
                }} />
              ))}
            </div>
          ) : result ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {result.summary ? (
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>{result.summary}</p>
              ) : null}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 10 }}>
                  Transform steps ({result.transforms?.length ?? 0})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(result.transforms ?? []).map((t, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      borderRadius: 8, background: "rgba(108,142,247,0.05)", border: "1px solid var(--glass-border)",
                    }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                      <Badge>{t.type}</Badge>
                      <code style={{ fontSize: 13, color: "var(--text)" }}>{t.field}</code>
                      {t.replacement ? (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>→ &ldquo;{t.replacement}&rdquo;</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="No plan generated" description="Select a dataset and describe a data-prep goal to preview transformation steps." />
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
