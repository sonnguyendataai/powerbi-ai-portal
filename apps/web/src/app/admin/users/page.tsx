"use client";

import { useEffect, useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

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

  useEffect(() => {
    void loadUsers();
  }, []);

  return (
    <section>
      <PageHeader eyebrow="Identity" title="Users" description="Manage portal users, tenant bindings, and assigned roles." actions={<button onClick={() => void loadUsers()}>Refresh</button>} />
      {error ? <Alert>{error}</Alert> : null}
      <Surface>
        {users.length === 0 ? <EmptyState title="No users loaded" description="Refresh to load users from the operational store." /> : null}
        <table className="table">
          <thead><tr><th>Email</th><th>Tenant</th><th>Roles</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}><td>{user.email}</td><td>{user.tenantId}</td><td>{user.roleIds.join(", ")}</td></tr>
            ))}
          </tbody>
        </table>
      </Surface>
    </section>
  );
}
