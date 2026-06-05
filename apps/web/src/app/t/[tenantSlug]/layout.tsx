import Link from "next/link";
import type { ReactNode } from "react";
import { requireServerSession } from "@/session-server";
import { BrandLogo } from "@/components/ui";

interface TenantLayoutProps {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { tenantSlug } = await params;
  const session = await requireServerSession({ tenantSlug });
  const nav = [
    ["Dashboard", `/t/${tenantSlug}/dashboard`],
    ["Reports", `/t/${tenantSlug}/reports`],
    ["Agent", `/t/${tenantSlug}/agent`],
    ["Data Prep", `/t/${tenantSlug}/data-prep`],
    ["Chart Studio", `/t/${tenantSlug}/chart-studio`],
  ] as const;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <BrandLogo compact />
        <div className="nav-section">
          <div className="nav-label">Tenant</div>
          <span className="badge">{tenantSlug}</span>
        </div>
        <nav className="nav-section">
          <div className="nav-label">Workspace</div>
          {nav.map(([label, href]) => (
            <Link className="nav-link" key={href} href={href}>{label}<span>→</span></Link>
          ))}
        </nav>
        <nav className="nav-section">
          <div className="nav-label">Operations</div>
          {session.roles.includes("portal-admin") ? <Link className="nav-link" href="/admin">Admin Console<span>→</span></Link> : null}
          <form action="/api/auth/logout" method="post">
            <button className="secondary" type="submit" style={{ width: "100%" }}>Logout</button>
          </form>
        </nav>
      </aside>
      <section className="main-panel">
        <div className="topbar">
          <div>
            <div className="eyebrow">DataMind Portal</div>
            <div className="muted">Signed in as {session.sub}</div>
          </div>
          <span className="badge">{session.roles.join(" · ")}</span>
        </div>
        {children}
      </section>
    </main>
  );
}
