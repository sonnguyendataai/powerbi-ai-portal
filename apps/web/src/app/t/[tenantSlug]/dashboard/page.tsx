import Link from "next/link";

interface DashboardProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function TenantDashboardPage({ params }: DashboardProps) {
  const { tenantSlug } = await params;
  return (
    <section>
      <h2>Executive Dashboard</h2>
      <p>Production home for tenant analytics operations and AI workflows.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {[
          ["Reports", "Use /reports to browse available BI assets."],
          ["Favorites", "Pin frequently used reports for quick access."],
          ["Sync status", "Admin sync center tracks source freshness."],
          ["AI Assistant", "Ask data questions with evidence grounding."],
        ].map(([title, text]) => (
          <article key={title} style={{ border: "1px solid #2a355e", borderRadius: 8, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>{title}</h3>
            <p style={{ marginBottom: 0 }}>{text}</p>
          </article>
        ))}
      </div>
      <p style={{ marginTop: 16 }}>
        Quick start: <Link href={`/t/${tenantSlug}/reports`}>Open reports</Link> ·{" "}
        <Link href={`/t/${tenantSlug}/agent`}>Open AI agent</Link>
      </p>
    </section>
  );
}
