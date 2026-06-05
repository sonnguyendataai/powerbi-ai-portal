import Link from "next/link";
import { MetricCard, PageHeader, Surface } from "@/components/ui";

interface DashboardProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function TenantDashboardPage({ params }: DashboardProps) {
  const { tenantSlug } = await params;
  return (
    <section>
      <PageHeader
        eyebrow="Executive workspace"
        title="Data command center"
        description="Monitor content freshness, launch governed reports, and ask AI-assisted questions from one branded workspace."
        actions={<Link className="button" href={`/t/${tenantSlug}/reports`}>Open reports</Link>}
      />
      <div className="metric-grid">
        <MetricCard label="Synced reports" value="Live" hint="Loaded from Power BI metadata sync" />
        <MetricCard label="Favorites" value="Ready" hint="Pinned report experience enabled" />
        <MetricCard label="AI analyst" value="On" hint="Evidence-aware answers" />
        <MetricCard label="Governance" value="RBAC" hint="Tenant and role guarded" />
      </div>
      <div className="grid-2" style={{ marginTop: 18 }}>
        <Surface title="Recommended next steps">
          <div className="stack">
            <Link className="nav-link" href={`/t/${tenantSlug}/reports`}>Browse synced reports<span>→</span></Link>
            <Link className="nav-link" href={`/t/${tenantSlug}/agent`}>Ask the AI analyst<span>→</span></Link>
            <Link className="nav-link" href={`/t/${tenantSlug}/chart-studio`}>Generate a chart spec<span>→</span></Link>
          </div>
        </Surface>
        <Surface title="Data freshness">
          <p className="muted">Power BI content sync history and delta detail are managed in the admin Sync Center.</p>
          <Link className="button secondary" href="/admin/sync">View sync operations</Link>
        </Surface>
      </div>
    </section>
  );
}
