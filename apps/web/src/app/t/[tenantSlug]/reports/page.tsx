"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Alert, Badge, EmptyState, PageHeader } from "@/components/ui";

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
  const [search, setSearch] = useState("");

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId }),
    });
    if (res.ok) {
      await loadReports();
    } else {
      setError("Failed to toggle favorite.");
    }
  }

  useEffect(() => { void loadReports(); }, []);

  const filtered = reports.filter((r) =>
    search ? r.displayName.toLowerCase().includes(search.toLowerCase()) : true,
  );
  const favoriteReports = filtered.filter((r) => favorites.includes(r.id));
  const otherReports = filtered.filter((r) => !favorites.includes(r.id));

  return (
    <section>
      <PageHeader
        eyebrow="Content library"
        title="Reports"
        description="Synced Power BI reports. Open a report to enter the guided embed experience."
        actions={
          <button className="secondary" onClick={() => void loadReports()}>
            ↺ Refresh
          </button>
        }
      />

      {error ? <div style={{ marginBottom: 16 }}><Alert>{error}</Alert></div> : null}

      {/* Search bar */}
      {!loading && reports.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports…"
            style={{ maxWidth: 360 }}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="grid-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="report-card" style={{ gap: 10 }}>
              <div style={{ height: 18, width: "60%", borderRadius: 6, background: "rgba(108,142,247,0.08)" }} />
              <div style={{ height: 14, width: "80%", borderRadius: 6, background: "rgba(108,142,247,0.05)" }} />
              <div style={{ height: 14, width: "40%", borderRadius: 6, background: "rgba(108,142,247,0.05)" }} />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && reports.length === 0 ? (
        <EmptyState
          title="No synced reports yet"
          description="Run a Power BI content sync from Admin Sync Center. Once sync succeeds, reports appear here automatically."
          action={<Link className="button" href="/admin/sync">Open Sync Center</Link>}
        />
      ) : null}

      {!loading && favoriteReports.length > 0 ? (
        <div style={{ marginBottom: 28 }}>
          <div style={{ marginBottom: 12, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
            ★ Favorites
          </div>
          <div className="grid-3">
            {favoriteReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                isFavorite
                tenantSlug={tenantSlug}
                onToggleFavorite={() => void toggleFavorite(report.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {!loading && otherReports.length > 0 ? (
        <div>
          {favoriteReports.length > 0 ? (
            <div style={{ marginBottom: 12, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
              All reports
            </div>
          ) : null}
          <div className="grid-3">
            {otherReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                isFavorite={false}
                tenantSlug={tenantSlug}
                onToggleFavorite={() => void toggleFavorite(report.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {!loading && filtered.length === 0 && reports.length > 0 ? (
        <EmptyState
          title="No results"
          description={`No reports match "${search}".`}
          action={<button className="secondary" onClick={() => setSearch("")}>Clear search</button>}
        />
      ) : null}
    </section>
  );
}

function ReportCard({
  report,
  isFavorite,
  tenantSlug,
  onToggleFavorite,
}: {
  report: ReportItem;
  isFavorite: boolean;
  tenantSlug: string;
  onToggleFavorite: () => void;
}) {
  return (
    <article className="report-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Badge variant={isFavorite ? "success" : "default"}>
          {isFavorite ? "★ Favorite" : "Power BI"}
        </Badge>
        <button
          onClick={onToggleFavorite}
          style={{
            background: "transparent",
            border: "none",
            padding: "4px 8px",
            fontSize: 14,
            color: isFavorite ? "var(--warning)" : "var(--text-muted)",
            minHeight: "unset",
            borderRadius: 6,
            boxShadow: "none",
          }}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      </div>
      <h3 className="report-card-title">{report.displayName}</h3>
      <div className="report-card-actions">
        <Link className="button" href={`/t/${tenantSlug}/reports/${report.id}`} style={{ flex: 1 }}>
          Open report
        </Link>
      </div>
    </article>
  );
}
