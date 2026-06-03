# Legacy Capability Mapping

This file maps strengths from `DatamindBiPortal_Phase5` into the new AI-first portal.

## Migrated strengths

- User/role administration:
  - old: `UserService`, `Role*` pages and APIs in .NET/Blazor
  - new: `packages/bi-operations` + `/api/admin/users` and `/api/admin/roles`

- Report/page/rule permissions:
  - old: user-role-report-rule-page joins and assignment workflows
  - new: `/api/admin/permissions` with explicit `userId/reportId/pageId/ruleId` contracts

- Favorite reports:
  - old: favorite operations in `PowerBiService` and user pages
  - new: favorite toggle via `/api/admin/reports` payload with `favorite`

- Import/export users:
  - old: CSV-like import/export operations and role/report reconciliation
  - new: `/api/admin/import-export` for export snapshots and controlled imports

## Deliberate upgrades in new portal

- Tenant-scoped policy enforcement is centralized instead of scattered service checks.
- AI orchestration and MCP/REST adapters are first-class and provider-agnostic.
- Documentation, runbooks, and `.agents` assets are versioned with code.
