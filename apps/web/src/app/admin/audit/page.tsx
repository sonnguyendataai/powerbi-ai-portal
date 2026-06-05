"use client";

import { useState } from "react";

interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  status: string;
  at: string;
}

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");

  async function loadAudit(): Promise<void> {
    const res = await fetch("/api/admin/audit");
    const json = (await res.json()) as { events?: AuditEvent[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to load audit events");
      return;
    }
    setError("");
    setEvents(json.events ?? []);
  }

  return (
    <section>
      <h2>Audit</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => void loadAudit()}>Load</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <ul>
        {events.map((event) => (
          <li key={event.id}>{event.at} · {event.actor} · {event.action} · {event.status}</li>
        ))}
      </ul>
    </section>
  );
}
