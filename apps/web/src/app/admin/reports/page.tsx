"use client";

import { useState } from "react";

interface ReportItem {
  id: string;
  displayName: string;
  workspaceId: string;
  datasetId: string;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [error, setError] = useState("");

  async function loadReports(): Promise<void> {
    const res = await fetch("/api/admin/reports");
    const json = (await res.json()) as { reports?: ReportItem[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to load reports");
      return;
    }
    setError("");
    setReports(json.reports ?? []);
  }

  return (
    <section>
      <h2>Reports</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => void loadReports()}>Load</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <ul>
        {reports.map((report) => (
          <li key={report.id}>
            {report.displayName} · workspace={report.workspaceId} · dataset={report.datasetId}
          </li>
        ))}
      </ul>
    </section>
  );
}
