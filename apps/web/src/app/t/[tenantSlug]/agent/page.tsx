"use client";

import { use, useState } from "react";

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
      <h2>AI Analyst</h2>
      <p>Ask natural-language questions and inspect evidence + tools used.</p>
      <textarea value={question} onChange={(e) => setQuestion(e.target.value)} style={{ width: "100%", minHeight: 100 }} />
      <div style={{ marginTop: 8 }}>
        <button onClick={() => void ask()}>Ask</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {answer ? (
        <article style={{ border: "1px solid #2a355e", borderRadius: 8, padding: 12, marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Answer</h3>
          <p>{answer.answer}</p>
          <h4>Evidence</h4>
          <ul>{answer.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
          <h4>Tool Trace</h4>
          <ul>{answer.usedTools.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      ) : null}
    </section>
  );
}
