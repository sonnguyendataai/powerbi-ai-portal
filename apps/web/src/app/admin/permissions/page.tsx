"use client";

import { useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

interface PermissionItem {
  userId: string;
  reportId: string;
  pageId?: string;
  ruleId?: string;
}

export default function AdminPermissionsPage() {
  const [userId, setUserId] = useState("user@example.com");
  const [items, setItems] = useState<PermissionItem[]>([]);
  const [error, setError] = useState("");

  async function loadPermissions(): Promise<void> {
    const res = await fetch(`/api/admin/permissions?userId=${encodeURIComponent(userId)}`);
    const json = (await res.json()) as { permissions?: PermissionItem[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to load permissions");
      return;
    }
    setError("");
    setItems(json.permissions ?? []);
  }

  return (
    <section>
      <PageHeader eyebrow="Access matrix" title="Permissions" description="Review report/page/rule assignments for a user." />
      <Surface>
      <div className="grid-2">
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
        <button onClick={() => void loadPermissions()}>Load</button>
      </div>
      </Surface>
      {error ? <Alert>{error}</Alert> : null}
      <Surface>
        {items.length === 0 ? <EmptyState title="No permissions loaded" description="Enter a user and load assignments." /> : null}
        <table className="table">
          <thead><tr><th>User</th><th>Report</th><th>Page</th><th>Rule</th></tr></thead>
          <tbody>{items.map((item, idx) => <tr key={`${item.userId}-${item.reportId}-${idx}`}><td>{item.userId}</td><td>{item.reportId}</td><td>{item.pageId ?? "-"}</td><td>{item.ruleId ?? "-"}</td></tr>)}</tbody>
        </table>
      </Surface>
    </section>
  );
}
