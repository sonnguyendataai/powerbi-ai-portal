import type { ReactNode } from "react";
import { requireServerSession } from "@/session-server";
import { TenantSidebar, TenantTopbar } from "@/components/TenantSidebar";

interface TenantLayoutProps {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { tenantSlug } = await params;
  const session = await requireServerSession({ tenantSlug });

  return (
    <main className="app-shell">
      <TenantSidebar tenantSlug={tenantSlug} roles={session.roles} userSub={session.sub} />

      <section className="main-panel">
        <TenantTopbar userSub={session.sub} roles={session.roles} />
        {children}
      </section>
    </main>
  );
}
