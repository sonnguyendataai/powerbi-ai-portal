# Data Access Policy

- All resources must use tenant-scoped identifiers.
- Read operations are allowed by role matrix.
- Write/modeling operations require explicit analyst or admin role.
- Tool execution logs must include tenant, user, action, and outcome.
- Tenant routes must stay under `/t/[tenantSlug]/...` and match the authenticated tenant unless the user is `portal-admin`.
- Report list/detail UX should rely on assigned reports from `/api/reports`, not raw admin report APIs.
- Power BI content sync is an admin operation; only `portal-admin` can trigger it.
- If Power BI pages access fails with `401/403`, persist report/dataset metadata and expose diagnostics rather than dropping the entire sync.
