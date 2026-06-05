"use client";

import { useState } from "react";

interface RoleItem {
  id: string;
  name: string;
  isRequiredRule: boolean;
}

export default function AdminRolesPage() {
  const [adminKey, setAdminKey] = useState("");
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [error, setError] = useState("");

  async function loadRoles(): Promise<void> {
    const res = await fetch("/api/admin/roles", {
      headers: adminKey ? { "x-admin-api-key": adminKey } : {},
    });
    const json = (await res.json()) as { roles?: RoleItem[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to load roles");
      return;
    }
    setError("");
    setRoles(json.roles ?? []);
  }

  return (
    <section>
      <h2>Roles</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Admin API key" />
        <button onClick={() => void loadRoles()}>Load</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <ul>
        {roles.map((role) => (
          <li key={role.id}>{role.name} {role.isRequiredRule ? "(requires rule)" : ""}</li>
        ))}
      </ul>
    </section>
  );
}
