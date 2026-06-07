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

let sdkPromise: Promise<PowerBiService> | null = null;

function getPowerBi(): Promise<PowerBiService> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<PowerBiService>((resolve, reject) => {
    if (typeof window === "undefined") { sdkPromise = null; reject(new Error("SSR")); return; }
    if (window.powerbi) { resolve(window.powerbi); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/powerbi-client@2.23.10/dist/powerbi.min.js";
    script.async = true;
    const timer = setTimeout(() => {
      sdkPromise = null;
      reject(new Error("Power BI SDK load timed out. Check network access to cdn.jsdelivr.net."));
    }, 15_000);
    script.onload = () => {
      clearTimeout(timer);
      if (window.powerbi) { resolve(window.powerbi); }
      else { sdkPromise = null; reject(new Error("SDK loaded but window.powerbi not set.")); }
    };
    script.onerror = () => {
      clearTimeout(timer);
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

interface EmbedReady {
  report: ReportRecord;
  embedToken: string;
  embedUrl: string;
}

export default function ReportDetailPage({ params }: ReportPageProps) {
  const { reportId } = use(params);
  const [embedReady, setEmbedReady] = useState<EmbedReady | null>(null);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("Loading report metadata…");
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  // Track whether we've called embed() for this token to avoid double-embed
  const embeddedTokenRef = useRef("");

  // Phase 1: fetch metadata + token (no DOM interaction)
  async function fetchEmbedData(): Promise<void> {
    setError("");
    setEmbedReady(null);
    setIsLoading(true);
    embeddedTokenRef.current = "";

    setLoadingMsg("Loading report metadata…");
    let found: ReportRecord | undefined;
    try {
      const res = await fetch("/api/reports");
      const json = (await res.json()) as { reports?: ReportRecord[] };
      if (!res.ok || !json.reports) { setError("Unable to load report list."); setIsLoading(false); return; }
      found = json.reports.find((item) => item.id === reportId);
      if (!found) { setError("Report not found. It may not be synced or assigned to your account."); setIsLoading(false); return; }
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load reports"); setIsLoading(false); return; }

    setLoadingMsg("Requesting embed token…");
    try {
      const tokenRes = await fetch("/api/embed/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: found.id, workspaceId: found.workspaceId, datasetId: found.datasetId, rlsRoles: [] }),
      });
      const tokenJson = (await tokenRes.json()) as { embedToken?: string; embedUrl?: string; error?: string };
      if (!tokenRes.ok) { setError(tokenJson.error ?? "Cannot create embed token."); setIsLoading(false); return; }
      // Setting embedReady triggers Phase 2 via useEffect below
      setEmbedReady({
        report: found,
        embedToken: tokenJson.embedToken ?? "",
        embedUrl: tokenJson.embedUrl ?? found.embedUrl,
      });
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to fetch embed token"); setIsLoading(false); return; }
  }

  // Phase 2: once embedReady is set AND the container div is in the DOM, call pbi.embed()
  useEffect(() => {
    if (!embedReady) return;
    // Guard: don't re-embed if already embedded this token
    if (embeddedTokenRef.current === embedReady.embedToken) return;

    let cancelled = false;

    async function doEmbed() {
      if (!embedReady) return;
      setLoadingMsg("Loading Power BI SDK…");
      let pbi: PowerBiService;
      try {
        pbi = await getPowerBi();
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : "Failed to load Power BI SDK"); setIsLoading(false); }
        return;
      }
      if (cancelled) return;

      if (!containerRef.current) {
        if (!cancelled) { setError("Embed container not mounted."); setIsLoading(false); }
        return;
      }

      setLoadingMsg("Initialising embed…");
      // Reset any prior embed on this container
      pbi.reset(containerRef.current);

      pbi.embed(containerRef.current, {
        type: "report",
        id: embedReady.report.id,
        embedUrl: embedReady.embedUrl,
        accessToken: embedReady.embedToken,
        tokenType: 1,   // 1 = Embed token (not AAD)
        settings: {
          panes: {
            filters: { visible: false },
            pageNavigation: { visible: true },
          },
          background: 2, // 2 = Transparent
        },
      });

      embeddedTokenRef.current = embedReady.embedToken;
      if (!cancelled) setIsLoading(false);
    }

    void doEmbed();
    return () => { cancelled = true; };
  }, [embedReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current && window.powerbi) {
        window.powerbi.reset(containerRef.current);
      }
    };
  }, []);

  // Kick off on mount / reportId change
  useEffect(() => {
    void fetchEmbedData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  return (
    <section>
      <PageHeader
        eyebrow="Report workspace"
        title={embedReady?.report.displayName ?? "Loading report…"}
        description="Power BI report embedded with a short-lived access token."
        actions={
          <button className="secondary" onClick={() => void fetchEmbedData()} disabled={isLoading}>
            {isLoading ? loadingMsg : "Refresh token"}
          </button>
        }
      />
      {error ? <Alert>{error}</Alert> : null}
      {isLoading && !error ? (
        <div className="empty-state" style={{ marginBottom: 16 }}>{loadingMsg}</div>
      ) : null}

      <Surface style={{ marginTop: error || isLoading ? 16 : 0 }}>
        {embedReady ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div>
              <span className="badge">Power BI report</span>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}><code>{embedReady.report.id}</code></p>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
                Workspace <code>{embedReady.report.workspaceId}</code> · Dataset <code>{embedReady.report.datasetId}</code>
              </p>
            </div>
            {!isLoading ? <span className="badge success">Token ready</span> : null}
          </div>
        ) : null}

        {/* Container is always mounted so powerbi-client can measure dimensions.
            We keep it visible from the start — hiding it with display:none before
            embed() causes the SDK to silently fail to initialise. */}
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "75vh",
            minHeight: 480,
            borderRadius: "var(--radius)",
            overflow: "hidden",
            background: "var(--bg-soft)",
            // Show once we have a report to embed; hide with opacity to preserve dimensions
            opacity: embedReady && !isLoading ? 1 : 0,
            transition: "opacity 0.3s",
          }}
        />
        {!embedReady && !isLoading && !error ? (
          <EmptyState title="Report not loaded" description="Click Refresh token to reload the report." />
        ) : null}
      </Surface>
    </section>
  );
}
