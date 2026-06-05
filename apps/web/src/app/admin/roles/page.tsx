"use client";

import { useEffect, useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

interface RoleItem {
  id: string;
  name: string;
  isRequiredRule: boolean;
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [error, setError] = useState("");

  async function loadRoles(): Promise<void> {
    const res = await fetch("/api/admin/roles");
    const json = (await res.json()) as { roles?: RoleItem[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to load roles");
      return;
    }
    setError("");
    setRoles(json.roles ?? []);
  }

  useEffect(() => {
    void loadRoles();
  }, []);

  return (
    <section>
      <PageHeader eyebrow="Access control" title="Roles" description="Review portal roles and rule requirements." actions={<button onClick={() => void loadRoles()}>Refresh</button>} />
      {error ? <Alert>{error}</Alert> : null}
      <Surface>
        {roles.length === 0 ? <EmptyState title="No roles loaded" description="Refresh to load role definitions." /> : null}
        <table className="table">
          <thead><tr><th>Role</th><th>Rule required</th></tr></thead>
          <tbody>{roles.map((role) => <tr key={role.id}><td>{role.name}</td><td>{role.isRequiredRule ? "Yes" : "No"}</td></tr>)}</tbody>
        </table>
      </Surface>
    </section>
  );
}
