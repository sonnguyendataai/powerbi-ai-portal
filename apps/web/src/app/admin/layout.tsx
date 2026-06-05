import Link from "next/link";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const nav = [
    ["/admin/users", "Users"],
    ["/admin/roles", "Roles"],
    ["/admin/reports", "Reports"],
    ["/admin/permissions", "Permissions"],
    ["/admin/import-export", "Import/Export"],
    ["/admin/rules", "Rules"],
    ["/admin/audit", "Audit"],
    ["/admin/sync", "Sync"],
  ] as const;

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <h1>Admin Console</h1>
      <nav style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {nav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      {children}
    </main>
  );
}
