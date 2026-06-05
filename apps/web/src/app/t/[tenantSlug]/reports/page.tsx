"use client";

import Link from "next/link";
import { use, useState } from "react";

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
  const [adminKey, setAdminKey] = useState("");
  const [userId, setUserId] = useState("user@example.com");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function loadReports(): Promise<void> {
    setError("");
    const res = await fetch(`/api/admin/reports?userId=${encodeURIComponent(userId)}`, {
      headers: adminKey ? { "x-admin-api-key": adminKey } : {},
    });
    const json = (await res.json()) as ReportsResponse;
    if (!res.ok) {
      setError("Failed to load reports. Provide admin key if required.");
      return;
    }
    setReports(json.reports ?? []);
    setFavorites(json.favorites ?? []);
  }

  async function toggleFavorite(reportId: string): Promise<void> {
    const res = await fetch("/api/admin/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminKey ? { "x-admin-api-key": adminKey } : {}),
      },
      body: JSON.stringify({ favorite: { userId, reportId } }),
    });
    if (res.ok) {
      await loadReports();
    } else {
      setError("Failed to toggle favorite.");
    }
  }

  return (
    <section>
      <h2>Reports</h2>
      <p>Browse tenant reports and manage favorites.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Admin API key" />
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
        <button onClick={() => void loadReports()}>Load</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <div style={{ display: "grid", gap: 8 }}>
        {reports.map((report) => {
          const favored = favorites.includes(report.id);
          return (
            <article key={report.id} style={{ border: "1px solid #2a355e", borderRadius: 8, padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>{report.displayName}</h3>
              <p style={{ margin: "0 0 8px" }}><code>{report.id}</code></p>
              <div style={{ display: "flex", gap: 10 }}>
                <Link href={`/t/${tenantSlug}/reports/${report.id}`}>Open report</Link>
                <button onClick={() => void toggleFavorite(report.id)}>
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
