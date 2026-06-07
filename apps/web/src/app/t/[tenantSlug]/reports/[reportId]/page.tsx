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

interface PowerBiService {
  embed: (container: HTMLElement, config: object) => void;
  reset: (container: HTMLElement) => void;
}

declare global {
  interface Window {
    powerbi?: PowerBiService;
  }
}

// Module-level promise so the script tag is only inserted once
let sdkPromise: Promise<PowerBiService> | null = null;

function getPowerBi(): Promise<PowerBiService> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<PowerBiService>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("SSR context"));
      return;
    }
    // SDK CDN build sets window.powerbi on load
    if (window.powerbi) {
      resolve(window.powerbi);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/powerbi-client@2.23.10/dist/powerbi.min.js";
    script.async = true;
    const timeout = setTimeout(() => {
      sdkPromise = null;
      reject(new Error("Power BI SDK load timed out (15s). Check network or CDN access."));
    }, 15_000);
    script.onload = () => {
      clearTimeout(timeout);
      if (window.powerbi) {
        resolve(window.powerbi);
      } else {
        sdkPromise = null;
        reject(new Error("Power BI SDK loaded but window.powerbi is not set."));
      }
    };
    script.onerror = () => {
      clearTimeout(timeout);
      sdkPromise = null;
      reject(new Error("Failed to load Power BI SDK from CDN."));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

interface ReportPageProps {
  params: Promise<{ tenantSlug: string; reportId: string }>;
}

type LoadStatus = "idle" | "loading-meta" | "loading-token" | "loading-sdk" | "embedding" | "done";

const STATUS_LABEL: Record<LoadStatus, string> = {
  idle: "",
  "loading-meta": "Loading report metadata…",
  "loading-token": "Requesting embed token…",
  "loading-sdk": "Loading Power BI SDK…",
  embedding: "Initialising embed…",
  done: "",
};

export default function ReportDetailPage({ params }: ReportPageProps) {
  const { reportId } = use(params);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadReportAndEmbed(): Promise<void> {
    setError("");

    // Reset previous embed
    getPowerBi()
      .then((pbi) => { if (containerRef.current) pbi.reset(containerRef.current); })
      .catch(() => {});

    // Step 1: report metadata
    setStatus("loading-meta");
    let found: ReportRecord | undefined;
    try {
      const res = await fetch("/api/reports");
      const json = (await res.json()) as { reports?: ReportRecord[] };
      if (!res.ok || !json.reports) {
        setError("Unable to load report list.");
        setStatus("idle");
        return;
      }
      found = json.reports.find((item) => item.id === reportId);
      if (!found) {
        setError("Report not found. It may not be synced or assigned to your account.");
        setStatus("idle");
        return;
      }
      setReport(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
      setStatus("idle");
      return;
    }

    // Step 2: embed token
    setStatus("loading-token");
    let embedToken: string;
    let embedUrl: string;
    try {
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
        error?: string;
      };
      if (!tokenRes.ok) {
        setError(tokenJson.error ?? "Cannot create embed token.");
        setStatus("idle");
        return;
      }
      embedToken = tokenJson.embedToken ?? "";
      embedUrl = tokenJson.embedUrl ?? found.embedUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch embed token");
      setStatus("idle");
      return;
    }

    // Step 3: load SDK from CDN (cached after first call)
    setStatus("loading-sdk");
    let pbi: PowerBiService;
    try {
      pbi = await getPowerBi();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Power BI SDK");
      setStatus("idle");
      return;
    }

    // Step 4: embed
    setStatus("embedding");
    if (!containerRef.current) {
      setError("Embed container not ready.");
      setStatus("idle");
      return;
    }

    pbi.embed(containerRef.current, {
      type: "report",
      id: found.id,
      embedUrl,
      accessToken: embedToken,
      tokenType: 1, // 1 = Embed token (not AAD)
      settings: {
        panes: {
          filters: { visible: false },
          pageNavigation: { visible: true },
        },
        background: 2, // 2 = Transparent
      },
    });

    setStatus("done");
  }

  useEffect(() => {
    void loadReportAndEmbed();
    return () => {
      getPowerBi()
        .then((pbi) => { if (containerRef.current) pbi.reset(containerRef.current); })
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const isLoading = status !== "idle" && status !== "done";

  return (
    <section>
      <PageHeader
        eyebrow="Report workspace"
        title={report?.displayName ?? "Loading report…"}
        description="Power BI report embedded with a short-lived access token."
        actions={
          <button
            className="secondary"
            onClick={() => void loadReportAndEmbed()}
            disabled={isLoading}
          >
            {isLoading ? STATUS_LABEL[status] : "Refresh token"}
          </button>
        }
      />
      {error ? <Alert>{error}</Alert> : null}
      {isLoading && !error ? (
        <div className="empty-state" style={{ marginBottom: 16 }}>
          {STATUS_LABEL[status]}
        </div>
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
            {status === "done" ? (
              <span className="badge success">Token ready</span>
            ) : null}
          </div>
          {/* powerbi-client SDK manages an iframe inside this div */}
          <div
            ref={containerRef}
            style={{
              width: "100%",
              height: "75vh",
              minHeight: 480,
              borderRadius: "var(--radius)",
              overflow: "hidden",
              background: "var(--bg-soft)",
              display: status === "done" || status === "embedding" ? "block" : "none",
            }}
          />
          {status === "idle" && !error ? (
            <EmptyState
              title="Report not loaded"
              description="Click Refresh token to reload the report."
            />
          ) : null}
        </Surface>
      ) : null}
    </section>
  );
}
