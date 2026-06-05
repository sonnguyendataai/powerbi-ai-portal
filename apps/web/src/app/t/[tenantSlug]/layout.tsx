import Link from "next/link";
import type { ReactNode } from "react";
import { requireServerSession } from "@/session-server";

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
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Tenant Portal</h1>
          <p style={{ margin: "4px 0 0", opacity: 0.8 }}>Tenant: <code>{tenantSlug}</code></p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {session.roles.includes("portal-admin") ? <Link href="/admin">Admin</Link> : null}
          <form action="/api/auth/logout" method="post">
            <button type="submit">Logout</button>
          </form>
        </div>
      </header>
      <nav style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        {nav.map(([label, href]) => (
          <Link key={href} href={href}>{label}</Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
