# Power BI AI Portal Enterprise

Enterprise AI portal for Power BI with app-owns-data embedding, policy-governed agent orchestration, and natural-language analytics workflows.

## Quick start

```bash
pnpm install
pnpm typecheck
pnpm test
```

## Core capabilities

- App-level RBAC/ABAC and EffectiveIdentity-based RLS for embed
- AI agent orchestration with MCP + REST adapters
- Evidence-first Q&A, data transformation workflows, and chart generation
- Governance-first architecture with audit, reliability, and compliance hooks
- Legacy-proven BI administration flows:
  - user/role/report/page/rule permission assignments
  - favorite report handling
  - user import/export for enterprise onboarding

## Admin and operations APIs

- `GET|POST /api/admin/users`
- `GET|POST /api/admin/roles`
- `POST /api/admin/reports` (includes favorite toggle payload)
- `GET|POST /api/admin/permissions`
- `GET|POST /api/admin/import-export`
