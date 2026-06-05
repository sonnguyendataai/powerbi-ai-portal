"use client";

import { useState } from "react";

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
      <h2>Permissions</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
        <button onClick={() => void loadPermissions()}>Load</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <ul>
        {items.map((item, idx) => (
          <li key={`${item.userId}-${item.reportId}-${idx}`}>
            user={item.userId} report={item.reportId} page={item.pageId ?? "-"} rule={item.ruleId ?? "-"}
          </li>
        ))}
      </ul>
    </section>
  );
}
