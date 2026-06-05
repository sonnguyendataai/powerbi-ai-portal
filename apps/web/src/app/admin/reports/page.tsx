"use client";

import { useEffect, useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

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

  useEffect(() => {
    void loadReports();
  }, []);

  return (
    <section>
      <PageHeader eyebrow="Content governance" title="Reports" description="Inspect synced Power BI report metadata." actions={<button onClick={() => void loadReports()}>Refresh</button>} />
      {error ? <Alert>{error}</Alert> : null}
      <Surface>
        {reports.length === 0 ? <EmptyState title="No reports loaded" description="Refresh after running content sync." /> : null}
        <table className="table">
          <thead><tr><th>Report</th><th>Workspace</th><th>Dataset</th></tr></thead>
          <tbody>{reports.map((report) => <tr key={report.id}><td>{report.displayName}</td><td>{report.workspaceId}</td><td>{report.datasetId}</td></tr>)}</tbody>
        </table>
      </Surface>
    </section>
  );
}
