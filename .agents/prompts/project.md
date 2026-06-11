# Project Prompt

This project implements a Power BI AI Portal in app-owns-data mode.

Context requirements:
- Use DataMind-branded portal UX with auto-loaded tenant/admin workflows.
- Authenticate through local username/password or Microsoft AD OIDC SSO; both must resolve to a signed HMAC `portal_session` cookie.
- Use portal RBAC/ABAC and EffectiveIdentity RLS mapping.
- Admin operations require `portal-admin`; never rely on an admin API key in product UX.
- AI Analyst calls Power BI REST API directly with service-principal OAuth — no external MCP servers needed or assumed.
- When `reportContext` is provided to the chat endpoint, skip tenant-wide enumeration; fetch only the active dataset schema for targeted evidence.
- Emit audit records for embed token mint, tool calls, and chart generation.
- Preserve enterprise BI admin operations (user/role/report/page/rule, favorites, import/export) while adding AI-first workflows.
- For Power BI REST failures, surface response body/request id and use `/api/admin/sync/diagnostics` before guessing permissions.
- Embed uses `powerbi-client` JS SDK (CDN); never use a plain `<iframe src>` for embed.
- Omit `identities` entirely from GenerateToken when dataset has no RLS — do not send an empty array.
- Theme and language preferences persist in `localStorage` via `ThemeLanguageProvider` (`portal-theme`, `portal-locale` keys).
- TypeScript strict mode with `exactOptionalPropertyTypes: true` — use spread pattern `...(x ? { x } : {})` for optional fields.
