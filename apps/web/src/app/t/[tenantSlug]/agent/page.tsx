"use client";

import { use, useState } from "react";
import { Alert, Badge, PageHeader } from "@/components/ui";

interface ChatResponse {
  answer: string;
  evidence: string[];
  usedTools: string[];
}

const SUGGESTED = [
  "What are the key sales trends this month?",
  "Which reports have the most engagement?",
  "Summarize the top performing datasets.",
  "What anomalies should I investigate?",
];

export default function TenantAgentPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  use(params);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ChatResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(): Promise<void> {
    if (!question.trim()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const json = (await res.json()) as ChatResponse & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Chat failed.");
        return;
      }
      setAnswer(json);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="AI experience"
        title="Ask DataMind"
        description="Ask governed business questions and review evidence, limitations, and tool traces."
      />

      <div className="workspace-layout">
        {/* Question panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="surface" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="surface-title">Your question</div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about your data…"
              style={{ minHeight: 140, resize: "vertical" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void ask();
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>⌘+Enter to send</span>
              <button onClick={() => void ask()} disabled={loading || !question.trim()}>
                {loading ? (
                  <>
                    <span style={{ display: "inline-block", animation: "spin 0.7s linear infinite" }}>⟳</span>
                    Thinking…
                  </>
                ) : "Ask AI analyst →"}
              </button>
            </div>
            {error ? <Alert>{error}</Alert> : null}
          </div>

          <div className="surface">
            <div className="surface-title">Suggested questions</div>
            <div className="stack-sm">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  className="ghost"
                  onClick={() => setQuestion(s)}
                  style={{
                    justifyContent: "flex-start",
                    textAlign: "left",
                    padding: "9px 12px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 13,
                    color: "var(--text-soft)",
                    background: "rgba(108,142,247,0.05)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "none",
                    minHeight: "unset",
                    whiteSpace: "normal",
                    lineHeight: 1.5,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Answer panel */}
        <div className="surface" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="surface-title">Answer & evidence</div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[80, 60, 90, 50].map((w, i) => (
                <div
                  key={i}
                  style={{
                    height: 14,
                    width: `${w}%`,
                    borderRadius: 6,
                    background: "linear-gradient(90deg, rgba(108,142,247,0.06) 0%, rgba(108,142,247,0.14) 50%, rgba(108,142,247,0.06) 100%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.4s infinite",
                  }}
                />
              ))}
            </div>
          ) : answer ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "var(--text)" }}>{answer.answer}</p>
              </div>

              {answer.evidence.length > 0 ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 10 }}>
                    Evidence
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {answer.evidence.map((item) => (
                      <div
                        key={item}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "rgba(52, 211, 153, 0.06)",
                          border: "1px solid rgba(52, 211, 153, 0.15)",
                          fontSize: 13,
                          color: "var(--text-soft)",
                        }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {answer.usedTools.length > 0 ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 10 }}>
                    Tool trace
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {answer.usedTools.map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 12, color: "var(--text-muted)", textAlign: "center" }}>
              <div style={{ fontSize: 36, opacity: 0.4 }}>🤖</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                Submit a question to generate an<br />evidence-aware answer.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </section>
  );
}
