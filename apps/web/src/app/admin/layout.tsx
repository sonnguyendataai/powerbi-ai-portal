import Link from "next/link";
import type { ReactNode } from "react";
import { requireServerSession } from "@/session-server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireServerSession({ adminOnly: true });
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
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Admin Console</h1>
        <form action="/api/auth/logout" method="post">
          <button type="submit">Logout</button>
        </form>
      </header>
      <nav style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {nav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      {children}
    </main>
  );
}
