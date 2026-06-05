import Link from "next/link";
import type { ReactNode } from "react";
import { requireServerSession } from "@/session-server";
import { BrandLogo } from "@/components/ui";

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
    <main className="app-shell">
      <aside className="sidebar">
        <BrandLogo compact />
        <div className="nav-section">
          <div className="nav-label">Admin modules</div>
          {nav.map(([href, label]) => <Link className="nav-link" key={href} href={href}>{label}<span>→</span></Link>)}
        </div>
        <form className="nav-section" action="/api/auth/logout" method="post">
          <button className="secondary" type="submit" style={{ width: "100%" }}>Logout</button>
        </form>
      </aside>
      <section className="main-panel">
        <div className="topbar">
          <div>
            <div className="eyebrow">Administration</div>
            <h1 style={{ margin: 0 }}>Control Center</h1>
          </div>
          <span className="badge">portal-admin</span>
        </div>
        {children}
      </section>
    </main>
  );
}
