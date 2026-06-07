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

// Minimal surface of powerbi-client we use
interface PowerBiEmbed {
  on: (event: string, handler: (event: { detail?: { message?: string; errorCode?: string } }) => void) => void;
  off: (event: string) => void;
}
interface PowerBiService {
  embed: (container: HTMLElement, config: object) => PowerBiEmbed;
  reset: (container: HTMLElement) => void;
}
declare global {
  interface Window { powerbi?: PowerBiService; }
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
      reject(new Error("Power BI SDK load timed out (15s). CDN may be unreachable."));
    }, 15_000);
    script.onload = () => {
      clearTimeout(timer);
      if (window.powerbi) { resolve(window.powerbi); }
      else { sdkPromise = null; reject(new Error("SDK loaded but window.powerbi is not set.")); }
    };
    script.onerror = () => {
      clearTimeout(timer); sdkPromise = null;
      reject(new Error("Failed to load powerbi-client from cdn.jsdelivr.net."));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

interface ReportPageProps {
  params: Promise<{ tenantSlug: string; reportId: string }>;
}

interface EmbedData {
  report: ReportRecord;
  embedToken: string;
  embedUrl: string;
}

export default function ReportDetailPage({ params }: ReportPageProps) {
  const { reportId } = use(params);
  const [embedData, setEmbedData] = useState<EmbedData | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState("Loading report…");
  const [isLoading, setIsLoading] = useState(true);
  const [reportLoaded, setReportLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<PowerBiEmbed | null>(null);
  const tokenRef = useRef("");

  async function fetchAndEmbed(): Promise<void> {
    setError("");
    setReportLoaded(false);
    setIsLoading(true);
    tokenRef.current = "";

    if (containerRef.current && window.powerbi) {
      window.powerbi.reset(containerRef.current);
    }
    embedRef.current = null;

    // Step 1: report list
    setStep("Loading report metadata…");
    let found: ReportRecord | undefined;
    try {
      const res = await fetch("/api/reports");
      const json = (await res.json()) as { reports?: ReportRecord[] };
      if (!res.ok || !json.reports) { setError("Unable to load report list."); setIsLoading(false); return; }
      found = json.reports.find((r) => r.id === reportId);
      if (!found) { setError("Report not found. It may not be synced or you may not have access."); setIsLoading(false); return; }
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load reports"); setIsLoading(false); return; }

    // Step 2: embed token
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
    // Phase 2 happens in useEffect below — after React commits the container to DOM
  }

  // Phase 2: DOM is committed, container is mounted, now call pbi.embed()
  useEffect(() => {
    if (!embedData) return;
    if (tokenRef.current === embedData.embedToken) return; // already embedded

    let cancelled = false;
    (async () => {
      setStep("Loading Power BI SDK…");
      let pbi: PowerBiService;
      try { pbi = await getPowerBi(); }
      catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : "SDK load failed"); setIsLoading(false); }
        return;
      }
      if (cancelled || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      // eslint-disable-next-line no-console
      console.log("[pbi-embed] container rect:", rect.width, rect.height);

      setStep("Embedding report…");
      pbi.reset(containerRef.current);

      const embed = pbi.embed(containerRef.current, {
        type: "report",
        id: embedData.report.id,
        embedUrl: embedData.embedUrl,
        accessToken: embedData.embedToken,
        tokenType: 1,        // 1 = Embed token
        settings: {
          panes: {
            filters: { visible: false },
            pageNavigation: { visible: true },
          },
          background: 1,     // 1 = Transparent (BackgroundType.Transparent)
        },
      });

      embedRef.current = embed;
      tokenRef.current = embedData.embedToken;

      embed.on("loaded", () => {
        if (!cancelled) { setReportLoaded(true); setIsLoading(false); }
      });

      embed.on("error", (event) => {
        const msg = event?.detail?.message ?? event?.detail?.errorCode ?? "Unknown Power BI embed error";
        if (!cancelled) { setError(`Power BI: ${msg}`); setIsLoading(false); }
      });

      // Safety timeout — if neither loaded nor error fires within 30s
      const timeout = setTimeout(() => {
        if (!cancelled && !reportLoaded) {
          setError("Report did not load within 30 seconds. Check Power BI workspace permissions and that the service principal has access.");
          setIsLoading(false);
        }
      }, 30_000);

      return () => { clearTimeout(timeout); };
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current && window.powerbi) {
        window.powerbi.reset(containerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void fetchAndEmbed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  return (
    <section>
      <PageHeader
        eyebrow="Report workspace"
        title={embedData?.report.displayName ?? "Loading report…"}
        description="Power BI report embedded with a short-lived access token."
        actions={
          <button className="secondary" onClick={() => void fetchAndEmbed()} disabled={isLoading}>
            {isLoading ? step : "Refresh"}
          </button>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      {isLoading && !error ? (
        <div className="empty-state" style={{ marginBottom: 16 }}>{step}</div>
      ) : null}

      {embedData ? (
        <Surface>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div>
              <span className="badge">Power BI report</span>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}><code>{embedData.report.id}</code></p>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
                Workspace <code>{embedData.report.workspaceId}</code> · Dataset <code>{embedData.report.datasetId}</code>
              </p>
            </div>
            {reportLoaded ? <span className="badge success">Loaded</span> : null}
          </div>

          {/* Always in DOM so SDK can measure dimensions. Shown once token is ready. */}
          <div
            ref={containerRef}
            style={{
              width: "100%",
              height: "75vh",
              minHeight: 480,
              borderRadius: "var(--radius)",
              overflow: "hidden",
              background: "var(--bg-soft)",
              visibility: embedData ? "visible" : "hidden",
            }}
          />
        </Surface>
      ) : (
        !isLoading && !error ? (
          <EmptyState title="No report selected" description="Navigate to a report from the Reports list." />
        ) : null
      )}
    </section>
  );
}
