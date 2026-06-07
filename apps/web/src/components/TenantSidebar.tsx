"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/ui";
import { SidebarControls } from "@/components/SidebarControls";
import { useThemeLang } from "@/components/ThemeLanguageProvider";

interface TenantSidebarProps {
  tenantSlug: string;
  roles: string[];
  userSub: string;
}

export function TenantSidebar({ tenantSlug, roles, userSub }: TenantSidebarProps) {
  const { t } = useThemeLang();

  const navItems = [
    { key: "dashboard" as const, icon: "⊞", path: "dashboard" },
    { key: "reports" as const, icon: "📊", path: "reports" },
    { key: "aiAnalyst" as const, icon: "🤖", path: "agent" },
    { key: "dataPrep" as const, icon: "⚙️", path: "data-prep" },
    { key: "chartStudio" as const, icon: "✨", path: "chart-studio" },
  ] as const;

  return (
    <aside className="sidebar">
      <BrandLogo compact />

      <div className="nav-section">
        <div className="nav-label">{t("workspace")}</div>
        <div style={{ padding: "6px 10px 10px" }}>
          <span className="badge" style={{ fontSize: 12 }}>
            <span style={{ opacity: 0.7 }}>⬡</span> {tenantSlug}
          </span>
        </div>
      </div>

      <nav className="nav-section">
        <div className="nav-label">{t("navigation")}</div>
        {navItems.map(({ key, icon, path }) => (
          <Link className="nav-link" key={path} href={`/t/${tenantSlug}/${path}`}>
            <span className="nav-link-icon">{icon}</span>
            {t(key)}
          </Link>
        ))}
      </nav>

      <div className="nav-spacer" />

      <SidebarControls />

      <nav className="nav-section">
        {roles.includes("portal-admin") ? (
          <Link className="nav-link" href="/admin">
            <span className="nav-link-icon">🛡️</span>
            {t("adminConsole")}
          </Link>
        ) : null}
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="nav-link nav-signout">
            <span className="nav-link-icon">↩</span> {t("signOut")}
          </button>
        </form>
      </nav>
    </aside>
  );
}

export function TenantTopbar({ userSub, roles }: { userSub: string; roles: string[] }) {
  const { t } = useThemeLang();

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-eyebrow">{t("portalName")}</div>
        <div className="topbar-user">{t("signedInAs")} {userSub}</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {roles.map((role) => (
          <span className="badge" key={role}>{role}</span>
        ))}
      </div>
    </div>
  );
}
