import Link from "next/link";
import type { ReactNode } from "react";
import { requireServerSession } from "@/session-server";
import { BrandLogo } from "@/components/ui";

interface TenantLayoutProps {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "dashboard" },
  { label: "Reports", icon: "📊", path: "reports" },
  { label: "AI Analyst", icon: "🤖", path: "agent" },
  { label: "Data Prep", icon: "⚙️", path: "data-prep" },
  { label: "Chart Studio", icon: "✨", path: "chart-studio" },
] as const;

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { tenantSlug } = await params;
  const session = await requireServerSession({ tenantSlug });

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <BrandLogo compact />

        <div className="nav-section">
          <div className="nav-label">Workspace</div>
          <div style={{ padding: "6px 10px 10px" }}>
            <span className="badge" style={{ fontSize: 12 }}>
              <span style={{ opacity: 0.7 }}>⬡</span> {tenantSlug}
            </span>
          </div>
        </div>

        <nav className="nav-section">
          <div className="nav-label">Navigation</div>
          {NAV_ITEMS.map(({ label, icon, path }) => (
            <Link className="nav-link" key={path} href={`/t/${tenantSlug}/${path}`}>
              <span className="nav-link-icon">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="nav-spacer" />

        <nav className="nav-section">
          {session.roles.includes("portal-admin") ? (
            <Link className="nav-link" href="/admin">
              <span className="nav-link-icon">🛡️</span>
              Admin Console
            </Link>
          ) : null}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              style={{
                width: "100%",
                justifyContent: "flex-start",
                gap: 10,
                padding: "9px 10px",
                background: "transparent",
                border: "1px solid transparent",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-muted)",
                fontSize: 13.5,
                fontWeight: 500,
                transition: "all 0.18s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.background = "rgba(248,113,113,0.08)";
                el.style.borderColor = "rgba(248,113,113,0.2)";
                el.style.color = "#f87171";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.background = "transparent";
                el.style.borderColor = "transparent";
                el.style.color = "var(--text-muted)";
              }}
            >
              <span>↩</span> Sign out
            </button>
          </form>
        </nav>
      </aside>

      <section className="main-panel">
        <div className="topbar">
          <div className="topbar-left">
            <div className="topbar-eyebrow">DataMind Portal</div>
            <div className="topbar-user">Signed in as {session.sub}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {session.roles.map((role) => (
              <span className="badge" key={role}>{role}</span>
            ))}
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}
