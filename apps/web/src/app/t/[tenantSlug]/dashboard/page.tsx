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
        actions={
          <Link className="button" href={`/t/${tenantSlug}/reports`}>
            Open reports →
          </Link>
        }
      />

      <div className="metric-grid">
        <MetricCard label="Synced reports" value="Live" hint="Loaded from Power BI metadata sync" />
        <MetricCard label="Favorites" value="Ready" hint="Pinned report experience enabled" />
        <MetricCard label="AI analyst" value="On" hint="Evidence-aware answers via Claude" />
        <MetricCard label="Governance" value="RBAC" hint="Tenant and role guarded" />
      </div>

      <div className="grid-2">
        <Surface title="Quick actions">
          <div className="stack-sm">
            {[
              { label: "Browse synced reports", href: `/t/${tenantSlug}/reports`, icon: "📊" },
              { label: "Ask the AI analyst", href: `/t/${tenantSlug}/agent`, icon: "🤖" },
              { label: "Generate a chart spec", href: `/t/${tenantSlug}/chart-studio`, icon: "✨" },
              { label: "Prepare datasets", href: `/t/${tenantSlug}/data-prep`, icon: "⚙️" },
            ].map((item) => (
              <Link
                key={item.href}
                className="nav-link"
                href={item.href}
                style={{ borderRadius: "var(--radius-sm)" }}
              >
                <span>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={{ opacity: 0.4, fontSize: 13 }}>→</span>
              </Link>
            ))}
          </div>
        </Surface>

        <Surface title="System status">
          <div className="stack-sm">
            {[
              { label: "Power BI sync", status: "Connected", variant: "success" as const },
              { label: "AI analyst", status: "Ready", variant: "success" as const },
              { label: "Authentication", status: "Secure", variant: "success" as const },
              { label: "Data governance", status: "Active", variant: "success" as const },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--glass-border)",
                }}
              >
                <span style={{ fontSize: 13.5, color: "var(--text-soft)" }}>{item.label}</span>
                <span className={`badge ${item.variant}`}>{item.status}</span>
              </div>
            ))}
            <div style={{ paddingTop: 12 }}>
              <Link className="button secondary" href="/admin/sync" style={{ fontSize: 13 }}>
                View sync operations →
              </Link>
            </div>
          </div>
        </Surface>
      </div>
    </section>
  );
}
