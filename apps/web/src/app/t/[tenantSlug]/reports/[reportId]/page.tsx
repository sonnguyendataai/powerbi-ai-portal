"use client";

import { use, useEffect, useRef, useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

interface ReportRecord {
  id: string;
  displayName: string;
  workspaceId: string;
  datasetId: string;
  embedUrl: string;
}

interface EmbedConfig {
  type: "report";
  id: string;
  embedUrl: string;
  accessToken: string;
  tokenType: 1; // Embed token = 1
  settings: {
    panes: { filters: { visible: boolean }; pageNavigation: { visible: boolean } };
    background: 2; // Transparent = 2
  };
}

declare global {
  interface Window {
    powerbi?: {
      embed: (container: HTMLElement, config: EmbedConfig) => { off: (event: string) => void };
      reset: (container: HTMLElement) => void;
    };
  }
}

function loadPowerBiSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.powerbi) { resolve(); return; }
    const existing = document.getElementById("powerbi-client-sdk");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.id = "powerbi-client-sdk";
    script.src = "https://cdn.jsdelivr.net/npm/powerbi-client@2.23.10/dist/powerbi.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Power BI SDK"));
    document.head.appendChild(script);
  });
}

interface ReportPageProps {
  params: Promise<{ tenantSlug: string; reportId: string }>;
}

export default function ReportDetailPage({ params }: ReportPageProps) {
  const { reportId } = use(params);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadReportAndEmbed(): Promise<void> {
    setLoading(true);
    setError("");

    // Reset any previous embed
    if (containerRef.current && window.powerbi) {
      window.powerbi.reset(containerRef.current);
    }

    try {
      const res = await fetch("/api/reports");
      const json = (await res.json()) as { reports?: ReportRecord[] };
      if (!res.ok || !json.reports) {
        setError("Unable to load report list.");
        return;
      }
      const found = json.reports.find((item) => item.id === reportId) ?? null;
      setReport(found);
      if (!found) {
        setError("Report not found. It may not be synced or assigned to your account.");
        return;
      }

      const tokenRes = await fetch("/api/embed/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: found.id,
          workspaceId: found.workspaceId,
          datasetId: found.datasetId,
          rlsRoles: [],
        }),
      });
      const tokenJson = (await tokenRes.json()) as {
        embedToken?: string;
        embedUrl?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!tokenRes.ok) {
        setError(tokenJson.error ?? "Cannot create embed token for this report.");
        return;
      }
      const embedToken = tokenJson.embedToken ?? "";
      const embedUrl = tokenJson.embedUrl ?? found.embedUrl;

      await loadPowerBiSdk();

      if (!containerRef.current || !window.powerbi) {
        setError("Embed container not ready.");
        return;
      }

      const config: EmbedConfig = {
        type: "report",
        id: found.id,
        embedUrl,
        accessToken: embedToken,
        tokenType: 1,
        settings: {
          panes: {
            filters: { visible: false },
            pageNavigation: { visible: true },
          },
          background: 2,
        },
      };

      window.powerbi.embed(containerRef.current, config);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReportAndEmbed();
    return () => {
      if (containerRef.current && window.powerbi) {
        window.powerbi.reset(containerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  return (
    <section>
      <PageHeader
        eyebrow="Report workspace"
        title={report?.displayName ?? "Loading report…"}
        description="Power BI report embedded with a short-lived access token."
        actions={
          <button className="secondary" onClick={() => void loadReportAndEmbed()}>
            Refresh token
          </button>
        }
      />
      {error ? <Alert>{error}</Alert> : null}
      {loading ? (
        <div className="empty-state">Preparing embed token and loading report…</div>
      ) : null}
      {report ? (
        <Surface>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <span className="badge">Power BI report</span>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                <code>{report.id}</code>
              </p>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
                Workspace <code>{report.workspaceId}</code> · Dataset{" "}
                <code>{report.datasetId}</code>
              </p>
            </div>
            <span className="badge success">Token ready</span>
          </div>
          <div
            ref={containerRef}
            style={{
              width: "100%",
              height: "75vh",
              minHeight: 480,
              borderRadius: "var(--radius)",
              overflow: "hidden",
              background: "var(--bg-soft)",
            }}
          />
        </Surface>
      ) : null}
    </section>
  );
}
