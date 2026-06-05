# Target State

The portal is composed of:

- web app for user workflows and embedding
- dual auth layer for local username/password and Microsoft AD OIDC SSO
- agent service for planning and tool orchestration
- memory service for durable and episodic notes
- reusable packages for policy, tools, and embed token handling
- reusable BI operations package for user/role/report/page/rule governance
- normalized Supabase/Postgres persistence for `portal_*` auth state and `bi_ops_*` operational metadata

Design goal: replaceable LLM providers, replaceable tool backends, and role-governed admin workflows with no UI contract changes.

Current product contracts:

- `/login` is the DataMind-branded entry point.
- `/t/[tenantSlug]/*` routes are tenant-scoped and require a matching session.
- `/admin/*` requires `portal-admin`; `x-admin-api-key` is deprecated and should not be reintroduced into UI flows.
- Power BI sync should auto-load run history/workspaces and expose diagnostics for OAuth/workspace/report/pages access.
- Report list/detail screens auto-load; avoid requiring users to press `Load` for existing content.
