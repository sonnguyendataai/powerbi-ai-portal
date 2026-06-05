# Skill: bi-admin-operations

Use when managing enterprise BI governance workflows:

- user and role management
- report/page/rule permission assignments
- favorite report operations
- user import/export workflows
- Power BI content sync, run history, delta detail, and diagnostics

Execution requirements:
- enforce tenant-scoped resources
- require authenticated `portal-admin` role for admin pages and write operations
- emit audit and telemetry for every admin mutation
- do not use or reintroduce admin API key prompts in UI
- sync history/workspaces should auto-load; preserve no-cache semantics for history endpoints
- use `/api/admin/sync/diagnostics` when troubleshooting Power BI REST `401/403/400` errors
