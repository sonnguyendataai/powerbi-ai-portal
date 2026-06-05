"use client";

import { useState } from "react";

interface UserItem {
  id: string;
  email: string;
  tenantId: string;
  roleIds: string[];
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [error, setError] = useState("");

  async function loadUsers(): Promise<void> {
    const res = await fetch("/api/admin/users");
    const json = (await res.json()) as { users?: UserItem[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to load users");
      return;
    }
    setError("");
    setUsers(json.users ?? []);
  }

  return (
    <section>
      <h2>Users</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => void loadUsers()}>Load</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <ul>
        {users.map((user) => (
          <li key={user.id}>{user.email} · tenant={user.tenantId} · roles={user.roleIds.join(",")}</li>
        ))}
      </ul>
    </section>
  );
}
