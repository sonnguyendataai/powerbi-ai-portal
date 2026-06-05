"use client";

import { use, useMemo, useState } from "react";

interface ReportRecord {
  id: string;
  displayName: string;
  workspaceId: string;
  datasetId: string;
  embedUrl: string;
}

interface ReportPageProps {
  params: Promise<{ tenantSlug: string; reportId: string }>;
}

export default function ReportDetailPage({ params }: ReportPageProps) {
  const { tenantSlug, reportId } = use(params);
  const [adminKey, setAdminKey] = useState("");
  const [userId, setUserId] = useState("user@example.com");
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [embedToken, setEmbedToken] = useState("");
  const [error, setError] = useState("");

  async function loadReport(): Promise<void> {
    const res = await fetch(`/api/admin/reports?userId=${encodeURIComponent(userId)}`, {
      headers: adminKey ? { "x-admin-api-key": adminKey } : {},
    });
    const json = (await res.json()) as { reports?: ReportRecord[] };
    if (!res.ok || !json.reports) {
      setError("Unable to load report.");
      return;
    }
    const found = json.reports.find((item) => item.id === reportId) ?? null;
    setReport(found);
    if (!found) setError("Report not found for user.");
  }

  async function mintEmbedToken(): Promise<void> {
    if (!report) return;
    const res = await fetch("/api/embed/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantSlug,
        "x-user-id": userId,
        "x-user-roles": "analyst",
      },
      body: JSON.stringify({
        reportId: report.id,
        workspaceId: report.workspaceId,
        datasetId: report.datasetId,
        rlsRoles: ["TenantViewer"],
      }),
    });
    const json = (await res.json()) as { token?: string; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to mint token.");
      return;
    }
    setEmbedToken(json.token ?? "");
  }

  const canRenderIframe = useMemo(() => !!report?.embedUrl && !!embedToken, [report?.embedUrl, embedToken]);

  return (
    <section>
      <h2>Report Detail</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Admin API key" />
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
        <button onClick={() => void loadReport()}>Load report</button>
        <button onClick={() => void mintEmbedToken()} disabled={!report}>Mint embed token</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {report ? (
        <article style={{ border: "1px solid #2a355e", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{report.displayName}</h3>
          <p><code>{report.id}</code></p>
          {canRenderIframe ? (
            <iframe
              src={report.embedUrl}
              title={`report-${report.id}`}
              style={{ width: "100%", minHeight: 520, border: "1px solid #2a355e" }}
            />
          ) : (
            <p>Mint token to preview embed URL. Token is generated but iframe auth wiring is environment-specific.</p>
          )}
        </article>
      ) : null}
    </section>
  );
}
