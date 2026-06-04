# Power BI AI Portal Enterprise

Enterprise AI portal for Power BI with app-owns-data embedding, policy-governed agent orchestration, and natural-language analytics workflows.

## Quick start

```bash
pnpm install
pnpm typecheck
pnpm test
```

## Production readiness

- Set required production env vars from `.env.example`:
  - `APP_ENV=prod`
  - `POWERBI_TENANT_ID`, `POWERBI_CLIENT_ID`, `POWERBI_CLIENT_SECRET`
  - `PORTAL_ADMIN_API_KEY`
- Readiness probes:
  - `GET /api/health`
  - `GET /api/ready`
- CI quality gates run typecheck, tests, and web build in `.github/workflows/ci.yml`.
- Vercel deployment workflow is available in `.github/workflows/vercel-deploy.yml`.
- Vercel setup guide: `docs/runbooks/vercel-deployment.md`.
- BI admin operations persist snapshots to Postgres when `DATABASE_URL` is configured, with file fallback via `BI_OPS_STORE_FILE`.

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
