"use client";

import { use, useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

interface ChatResponse {
  answer: string;
  evidence: string[];
  usedTools: string[];
}

export default function TenantAgentPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  use(params);
  const [question, setQuestion] = useState("What are key sales trends this month?");
  const [answer, setAnswer] = useState<ChatResponse | null>(null);
  const [error, setError] = useState("");

  async function ask(): Promise<void> {
    setError("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: question }),
    });
    const json = (await res.json()) as ChatResponse & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Chat failed.");
      return;
    }
    setAnswer(json);
  }

  return (
    <section>
      <PageHeader
        eyebrow="AI experience"
        title="Ask DataMind"
        description="Ask governed business questions and review evidence, limitations, and tool traces in one workspace."
      />
      <div className="workspace-layout">
        <Surface title="Question">
          <div className="stack">
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} style={{ minHeight: 160 }} />
            <button onClick={() => void ask()}>Ask AI analyst</button>
            {error ? <Alert>{error}</Alert> : null}
          </div>
        </Surface>
        <Surface title="Answer and evidence">
          {answer ? (
            <div className="stack">
              <p>{answer.answer}</p>
              <div>
                <h4>Evidence</h4>
                <ul>{answer.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <h4>Tool trace</h4>
                <ul>{answer.usedTools.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          ) : (
            <EmptyState title="No answer yet" description="Submit a question to generate an evidence-aware answer." />
          )}
        </Surface>
      </div>
    </section>
  );
}
