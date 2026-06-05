"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Alert, EmptyState, PageHeader } from "@/components/ui";

interface ReportItem {
  id: string;
  displayName: string;
  workspaceId: string;
}

interface ReportsResponse {
  reports: ReportItem[];
  favorites?: string[];
}

export default function TenantReportsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadReports(): Promise<void> {
    setError("");
    setLoading(true);
    const res = await fetch("/api/reports");
    const json = (await res.json()) as ReportsResponse;
    if (!res.ok) {
      setError("Cannot load reports. Please confirm you are signed in and Power BI content has been synced.");
      setLoading(false);
      return;
    }
    setReports(json.reports ?? []);
    setFavorites(json.favorites ?? []);
    setLoading(false);
  }

  async function toggleFavorite(reportId: string): Promise<void> {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reportId }),
    });
    if (res.ok) {
      await loadReports();
    } else {
      setError("Failed to toggle favorite.");
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  return (
    <section>
      <PageHeader
        eyebrow="Content library"
        title="Reports"
        description="Synced Power BI reports are loaded automatically. Open a report to enter the guided embed experience."
        actions={<button className="secondary" onClick={() => void loadReports()}>Refresh</button>}
      />
      {error ? <Alert>{error}</Alert> : null}
      {loading ? <div className="empty-state">Loading synced reports...</div> : null}
      {!loading && reports.length === 0 ? (
        <EmptyState
          title="No synced reports yet"
          description="Run a Power BI content sync from Admin Sync Center. Once sync succeeds, reports appear here automatically."
          action={<Link className="button" href="/admin/sync">Open Sync Center</Link>}
        />
      ) : null}
      <div className="grid-3">
        {reports.map((report) => {
          const favored = favorites.includes(report.id);
          return (
            <article className="card" key={report.id}>
              <span className="badge">{favored ? "Favorite" : "Power BI"}</span>
              <h3 style={{ marginTop: 0 }}>{report.displayName}</h3>
              <p className="muted"><code>{report.id}</code></p>
              <div style={{ display: "flex", gap: 10 }}>
                <Link className="button" href={`/t/${tenantSlug}/reports/${report.id}`}>Open report</Link>
                <button className="secondary" onClick={() => void toggleFavorite(report.id)}>
                  {favored ? "Unfavorite" : "Favorite"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
