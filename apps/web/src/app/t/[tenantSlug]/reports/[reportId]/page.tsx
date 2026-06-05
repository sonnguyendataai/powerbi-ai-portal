"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

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
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [embedToken, setEmbedToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadReportAndToken(): Promise<void> {
    setLoading(true);
    setError("");
    const res = await fetch("/api/reports");
    const json = (await res.json()) as { reports?: ReportRecord[] };
    if (!res.ok || !json.reports) {
      setError("Unable to load report.");
      setLoading(false);
      return;
    }
    const found = json.reports.find((item) => item.id === reportId) ?? null;
    setReport(found);
    if (!found) {
      setError("Report not found. It may not be synced or assigned to your user.");
      setLoading(false);
      return;
    }
    const tokenRes = await fetch("/api/embed/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reportId: found.id,
        workspaceId: found.workspaceId,
        datasetId: found.datasetId,
        rlsRoles: ["TenantViewer"],
      }),
    });
    const tokenJson = (await tokenRes.json()) as { token?: string; error?: string };
    if (!tokenRes.ok) {
      setError(tokenJson.error ?? "Cannot create embed token for this report.");
      setLoading(false);
      return;
    }
    setEmbedToken(tokenJson.token ?? "");
    setLoading(false);
  }

  const canRenderIframe = useMemo(() => !!report?.embedUrl && !!embedToken, [report?.embedUrl, embedToken]);

  useEffect(() => {
    void loadReportAndToken();
  }, [reportId]);

  return (
    <section>
      <PageHeader
        eyebrow="Report workspace"
        title={report?.displayName ?? "Loading report"}
        description="Metadata and embed token are prepared automatically when you open this report."
        actions={<button className="secondary" onClick={() => void loadReportAndToken()}>Retry</button>}
      />
      {error ? <Alert>{error}</Alert> : null}
      {loading ? <div className="empty-state">Preparing report metadata and embed token...</div> : null}
      {report ? (
        <Surface>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div>
              <span className="badge">Power BI report</span>
              <p className="muted"><code>{report.id}</code></p>
            </div>
            <span className="badge">{embedToken ? "Token ready" : "Token pending"}</span>
          </div>
          {canRenderIframe ? (
            <iframe
              src={report.embedUrl}
              title={`report-${report.id}`}
              className="report-frame"
            />
          ) : (
            <EmptyState
              title="Embed preview is not ready"
              description="The portal could not complete metadata/token preparation. Check Power BI workspace permissions and synced metadata."
            />
          )}
        </Surface>
      ) : null}
    </section>
  );
}
