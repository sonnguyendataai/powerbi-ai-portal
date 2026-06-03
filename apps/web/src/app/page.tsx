const sampleEmbedPayload = {
  reportId: "00000000-0000-0000-0000-000000000000",
  workspaceId: "00000000-0000-0000-0000-000000000000",
  datasetId: "00000000-0000-0000-0000-000000000000",
  rlsRoles: ["TenantViewer"],
};

export default function HomePage() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Power BI AI Portal Enterprise</h1>
      <p>App-owns-data portal with policy-governed embedding, AI Q&A, and chart automation.</p>

      <section style={{ marginTop: 24 }}>
        <h2>Available API Endpoints</h2>
        <ul>
          <li><code>POST /api/embed/token</code></li>
          <li><code>POST /api/chat</code></li>
          <li><code>POST /api/chart</code></li>
          <li><code>POST /api/data-prep</code></li>
          <li><code>GET|POST /api/admin/users</code></li>
          <li><code>GET|POST /api/admin/roles</code></li>
          <li><code>POST /api/admin/reports</code></li>
          <li><code>GET|POST /api/admin/permissions</code></li>
          <li><code>GET|POST /api/admin/import-export</code></li>
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Legacy strengths integrated</h2>
        <ul>
          <li>User/role/report/page/rule permission management APIs</li>
          <li>Favorite report toggle and export/import user operations</li>
          <li>Tenant-aware policy checks aligned with app-owns-data embedding</li>
          <li>AI-native orchestration preserved on top of BI admin workflows</li>
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Sample embed request</h3>
        <pre style={{ background: "#101832", padding: 12, borderRadius: 8, overflowX: "auto" }}>
{JSON.stringify(sampleEmbedPayload, null, 2)}
        </pre>
      </section>
    </main>
  );
}
