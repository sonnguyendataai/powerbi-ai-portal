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
    const timer = setTimeout(() => { sdkPromise = null; reject(new Error("Power BI SDK load timed out (15 s).")); }, 15_000);
    script.onload = () => { clearTimeout(timer); window.powerbi ? resolve(window.powerbi) : (sdkPromise = null, reject(new Error("SDK loaded but window.powerbi not set."))); };
    script.onerror = () => { clearTimeout(timer); sdkPromise = null; reject(new Error("Failed to load Power BI SDK from CDN.")); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

interface ReportPageProps { params: Promise<{ tenantSlug: string; reportId: string }>; }
interface EmbedData { report: ReportRecord; embedToken: string; embedUrl: string; }
interface ChatMessage { role: "user" | "assistant"; text: string; }

export default function ReportDetailPage({ params }: ReportPageProps) {
  const { reportId } = use(params);
  const [embedData, setEmbedData] = useState<EmbedData | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState("Loading…");
  const [isLoading, setIsLoading] = useState(true);
  const [reportLoaded, setReportLoaded] = useState(false);

  // AI chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

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
        tokenType: 1,
        settings: { panes: { filters: { visible: false }, pageNavigation: { visible: true } }, background: 1 },
      });
      tokenRef.current = embedData.embedToken;
      const markLoaded = () => { if (!cancelled) { if (timeoutRef.current) clearTimeout(timeoutRef.current); setReportLoaded(true); setIsLoading(false); } };
      embed.on("loaded", markLoaded);
      embed.on("rendered", markLoaded);
      embed.on("error", (event) => {
        if (!cancelled) { if (timeoutRef.current) clearTimeout(timeoutRef.current); setError(`Power BI: ${event?.detail?.message ?? event?.detail?.errorCode ?? "Unknown error"}`); setIsLoading(false); }
      });
      timeoutRef.current = setTimeout(() => { if (!cancelled) setIsLoading(false); }, 60_000);
    })();
    return () => { cancelled = true; if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [embedData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { return () => { if (containerRef.current && window.powerbi) window.powerbi.reset(containerRef.current); }; }, []);
  useEffect(() => { void fetchAndEmbed(); }, [reportId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll chat to bottom on new messages
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  async function sendChat(text?: string): Promise<void> {
    const q = (text ?? chatInput).trim();
    if (!q || !embedData) return;
    setChatInput("");
    setChatError("");
    setChatMessages((prev) => [...prev, { role: "user", text: q }]);
    setChatBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          reportContext: {
            reportId: embedData.report.id,
            reportName: embedData.report.displayName,
            workspaceId: embedData.report.workspaceId,
            datasetId: embedData.report.datasetId,
          },
        }),
      });
      const json = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) { setChatError(json.error ?? "Chat failed."); return; }
      setChatMessages((prev) => [...prev, { role: "assistant", text: json.answer ?? "" }]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Chat request failed");
    } finally {
      setChatBusy(false);
    }
  }

  const SUGGESTIONS = [
    "What are the key insights from this report?",
    "Summarise the main trends visible here.",
    "What should I focus on first?",
    "Are there any anomalies I should investigate?",
  ];

  return (
    <section>
      <PageHeader
        eyebrow="Report"
        title={embedData?.report.displayName ?? "Loading…"}
        description="Power BI report embedded with a short-lived access token."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {reportLoaded ? (
              <button onClick={() => setChatOpen((v) => !v)}>
                {chatOpen ? "Close AI ✕" : "Ask AI 🤖"}
              </button>
            ) : null}
            <button className="secondary" onClick={() => void fetchAndEmbed()} disabled={isLoading}>
              {isLoading ? step : "↺ Refresh"}
            </button>
          </div>
        }
      />

      {error ? <Alert>{error}</Alert> : null}
      {isLoading && !error ? <div className="empty-state" style={{ marginBottom: 16 }}>{step}</div> : null}

      {embedData ? (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Report embed */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Surface>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span className="badge">Power BI</span>
                {reportLoaded ? <span className="badge success">● Live</span> : null}
              </div>
              <div
                ref={containerRef}
                style={{
                  width: "100%",
                  height: chatOpen ? "60vh" : "78vh",
                  minHeight: 420,
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                  background: "var(--bg-soft)",
                  visibility: embedData ? "visible" : "hidden",
                  transition: "height 0.25s",
                }}
              />
            </Surface>
          </div>

          {/* AI chat panel */}
          {chatOpen ? (
            <div style={{
              width: 360,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 0,
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius)",
              background: "var(--glass)",
              backdropFilter: "blur(20px)",
              overflow: "hidden",
              height: "calc(60vh + 60px)",
            }}>
              {/* Chat header */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>🤖</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>AI Analyst</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{embedData.report.displayName}</div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {chatMessages.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Ask about this report:</div>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => void sendChat(s)}
                        disabled={chatBusy}
                        style={{
                          background: "rgba(108,142,247,0.06)",
                          border: "1px solid var(--glass-border)",
                          borderRadius: "var(--radius-xs)",
                          color: "var(--text-soft)",
                          fontSize: 12,
                          padding: "8px 10px",
                          textAlign: "left",
                          cursor: "pointer",
                          minHeight: "unset",
                          boxShadow: "none",
                          lineHeight: 1.4,
                          whiteSpace: "normal",
                        }}
                      >{s}</button>
                    ))}
                  </div>
                ) : null}

                {chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  }}>
                    <div style={{
                      maxWidth: "88%",
                      padding: "8px 12px",
                      borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, var(--brand-1), var(--brand-2))"
                        : "rgba(255,255,255,0.06)",
                      border: msg.role === "assistant" ? "1px solid var(--glass-border)" : "none",
                      color: msg.role === "user" ? "#fff" : "var(--text)",
                      fontSize: 13,
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}>{msg.text}</div>
                  </div>
                ))}

                {chatBusy ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 12 }}>
                    <span style={{ display: "inline-block", animation: "spin 0.7s linear infinite" }}>⟳</span>
                    Analysing…
                  </div>
                ) : null}

                {chatError ? <div style={{ fontSize: 12, color: "var(--danger)" }}>{chatError}</div> : null}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "10px 12px", borderTop: "1px solid var(--glass-border)", display: "flex", gap: 8 }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about this report…"
                  style={{ flex: 1, minHeight: "unset", height: 36, padding: "6px 12px", fontSize: 13 }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !chatBusy) void sendChat(); }}
                  disabled={chatBusy}
                />
                <button
                  onClick={() => void sendChat()}
                  disabled={chatBusy || !chatInput.trim()}
                  style={{ minHeight: "unset", height: 36, padding: "0 14px", fontSize: 13, flexShrink: 0 }}
                >→</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        !isLoading && !error
          ? <EmptyState title="No report selected" description="Navigate to a report from the Reports list." />
          : null
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
