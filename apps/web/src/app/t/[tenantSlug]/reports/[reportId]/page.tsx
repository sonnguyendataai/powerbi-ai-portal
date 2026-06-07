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

interface PowerBiEmbed {
  on: (event: string, handler: (e: { detail?: { message?: string; errorCode?: string } }) => void) => void;
  off: (event: string) => void;
}
interface PowerBiService {
  embed: (container: HTMLElement, config: object) => PowerBiEmbed;
  reset: (container: HTMLElement) => void;
}
declare global { interface Window { powerbi?: PowerBiService; } }

let sdkPromise: Promise<PowerBiService> | null = null;
function getPowerBi(): Promise<PowerBiService> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<PowerBiService>((resolve, reject) => {
    if (typeof window === "undefined") { sdkPromise = null; reject(new Error("SSR")); return; }
    if (window.powerbi) { resolve(window.powerbi); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/powerbi-client@2.23.10/dist/powerbi.min.js";
    script.async = true;
    const timer = setTimeout(() => { sdkPromise = null; reject(new Error("Power BI SDK load timed out (15 s). Check network access.")); }, 15_000);
    script.onload = () => { clearTimeout(timer); window.powerbi ? resolve(window.powerbi) : (sdkPromise = null, reject(new Error("SDK loaded but window.powerbi not set."))); };
    script.onerror = () => { clearTimeout(timer); sdkPromise = null; reject(new Error("Failed to load Power BI SDK from cdn.jsdelivr.net.")); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

interface ReportPageProps { params: Promise<{ tenantSlug: string; reportId: string }>; }
interface EmbedData { report: ReportRecord; embedToken: string; embedUrl: string; }

export default function ReportDetailPage({ params }: ReportPageProps) {
  const { reportId } = use(params);
  const [embedData, setEmbedData] = useState<EmbedData | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState("Loading…");
  const [isLoading, setIsLoading] = useState(true);
  const [reportLoaded, setReportLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchAndEmbed(): Promise<void> {
    setError(""); setReportLoaded(false); setIsLoading(true); tokenRef.current = "";
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (containerRef.current && window.powerbi) window.powerbi.reset(containerRef.current);

    setStep("Loading report…");
    let found: ReportRecord | undefined;
    try {
      const res = await fetch("/api/reports");
      const json = (await res.json()) as { reports?: ReportRecord[] };
      if (!res.ok || !json.reports) { setError("Unable to load report list."); setIsLoading(false); return; }
      found = json.reports.find((r) => r.id === reportId);
      if (!found) { setError("Report not found. It may not be synced or you may not have access."); setIsLoading(false); return; }
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load reports"); setIsLoading(false); return; }

    setStep("Requesting embed token…");
    let embedToken: string, embedUrl: string;
    try {
      const res = await fetch("/api/embed/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: found.id, workspaceId: found.workspaceId, datasetId: found.datasetId, rlsRoles: [] }),
      });
      const json = (await res.json()) as { embedToken?: string; embedUrl?: string; error?: string };
      if (!res.ok) { setError(json.error ?? "Cannot create embed token."); setIsLoading(false); return; }
      embedToken = json.embedToken ?? "";
      embedUrl = json.embedUrl ?? found.embedUrl;
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to fetch embed token"); setIsLoading(false); return; }

    setEmbedData({ report: found, embedToken, embedUrl });
    // Phase 2 runs in useEffect after React commits the container
  }

  useEffect(() => {
    if (!embedData) return;
    if (tokenRef.current === embedData.embedToken) return;

    let cancelled = false;
    (async () => {
      setStep("Loading Power BI SDK…");
      let pbi: PowerBiService;
      try { pbi = await getPowerBi(); }
      catch (err) { if (!cancelled) { setError(err instanceof Error ? err.message : "SDK load failed"); setIsLoading(false); } return; }
      if (cancelled || !containerRef.current) return;

      setStep("Embedding report…");
      pbi.reset(containerRef.current);

      const embed = pbi.embed(containerRef.current, {
        type: "report",
        id: embedData.report.id,
        embedUrl: embedData.embedUrl,
        accessToken: embedData.embedToken,
        tokenType: 1,   // Embed token
        settings: {
          panes: { filters: { visible: false }, pageNavigation: { visible: true } },
          background: 1, // Transparent
        },
      });

      tokenRef.current = embedData.embedToken;

      embed.on("loaded", () => {
        if (!cancelled) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setReportLoaded(true);
          setIsLoading(false);
        }
      });
      embed.on("rendered", () => {
        if (!cancelled) { setReportLoaded(true); setIsLoading(false); }
      });
      embed.on("error", (event) => {
        if (!cancelled) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          const msg = event?.detail?.message ?? event?.detail?.errorCode ?? "Unknown embed error";
          setError(`Power BI: ${msg}`);
          setIsLoading(false);
        }
      });

      // 60 s safety net — the report IS usually rendering even before "loaded" fires
      timeoutRef.current = setTimeout(() => {
        if (!cancelled && !reportLoaded) {
          setIsLoading(false); // stop spinner; don't show error — embed may still be visible
        }
      }, 60_000);
    })();

    return () => { cancelled = true; if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedData]);

  useEffect(() => {
    return () => { if (containerRef.current && window.powerbi) window.powerbi.reset(containerRef.current); };
  }, []);

  useEffect(() => { void fetchAndEmbed(); }, [reportId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      <PageHeader
        eyebrow="Report"
        title={embedData?.report.displayName ?? "Loading…"}
        description="Power BI report embedded with a short-lived access token."
        actions={
          <button className="secondary" onClick={() => void fetchAndEmbed()} disabled={isLoading}>
            {isLoading ? step : "↺ Refresh"}
          </button>
        }
      />

      {error ? <Alert>{error}</Alert> : null}
      {isLoading && !error ? <div className="empty-state" style={{ marginBottom: 16 }}>{step}</div> : null}

      {embedData ? (
        <Surface>
          {/* Clean prod header — no internal IDs */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span className="badge">Power BI</span>
            {reportLoaded ? <span className="badge success">● Live</span> : null}
          </div>

          {/* powerbi-client SDK manages the iframe inside this div */}
          <div
            ref={containerRef}
            style={{
              width: "100%",
              height: "78vh",
              minHeight: 520,
              borderRadius: "var(--radius)",
              overflow: "hidden",
              background: "var(--bg-soft)",
              visibility: embedData ? "visible" : "hidden",
            }}
          />
        </Surface>
      ) : (
        !isLoading && !error
          ? <EmptyState title="No report selected" description="Navigate to a report from the Reports list." />
          : null
      )}
    </section>
  );
}
