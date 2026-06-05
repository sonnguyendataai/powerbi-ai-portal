"use client";

import { useEffect, useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

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

  useEffect(() => {
    void loadAudit();
  }, []);

  return (
    <section>
      <PageHeader eyebrow="Audit trail" title="Audit" description="Inspect recent administrative and sync operations." actions={<button onClick={() => void loadAudit()}>Refresh</button>} />
      {error ? <Alert>{error}</Alert> : null}
      <Surface>
        {events.length === 0 ? <EmptyState title="No audit events loaded" description="Refresh to load recent operations." /> : null}
        <table className="table">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Status</th></tr></thead>
          <tbody>{events.map((event) => <tr key={event.id}><td>{event.at}</td><td>{event.actor}</td><td>{event.action}</td><td><span className="badge">{event.status}</span></td></tr>)}</tbody>
        </table>
      </Surface>
    </section>
  );
}
