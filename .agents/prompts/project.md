# Project Prompt

This project implements a Power BI AI Portal in app-owns-data mode.

Context requirements:
- Use DataMind-branded portal UX with auto-loaded tenant/admin workflows.
- Authenticate through local username/password or Microsoft AD OIDC SSO; both must resolve to a signed `portal_session`.
- Use portal RBAC/ABAC and EffectiveIdentity RLS mapping.
- Admin operations require `portal-admin`; never rely on an admin API key in product UX.
- Use Power BI MCP/Fabric MCP first, then fallback to REST adapters.
- Emit audit records for embed token mint, tool calls, and chart generation.
- Preserve enterprise BI admin operations (user/role/report/page/rule, favorites, import/export) while adding AI-first workflows.
- For Power BI REST failures, surface response body/request id and use `/api/admin/sync/diagnostics` before guessing permissions.
