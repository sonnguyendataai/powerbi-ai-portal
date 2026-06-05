# Power BI AI Portal Enterprise

DataMind-branded enterprise AI portal for Power BI with app-owns-data embedding, dual authentication, role-governed administration, metadata sync, and natural-language analytics workflows.

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
  - `SESSION_SIGNING_SECRET`
  - `APP_BASE_URL`
  - Local bootstrap: `LOCAL_AUTH_BOOTSTRAP_USERNAME`, `LOCAL_AUTH_BOOTSTRAP_PASSWORD`, `LOCAL_AUTH_BOOTSTRAP_TENANT_ID`
  - Optional Microsoft AD SSO: `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_REDIRECT_URI`
  - Database: `DATABASE_URL` or Vercel Supabase-provided `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`
- Readiness probes:
  - `GET /api/health`
  - `GET /api/ready`
- CI quality gates run typecheck, tests, and web build in `.github/workflows/ci.yml`.
- Vercel deployment workflow is available in `.github/workflows/vercel-deploy.yml`.
- Vercel setup guide: `docs/runbooks/vercel-deployment.md`.
- BI admin operations persist to normalized Postgres tables when `DATABASE_URL` is configured.
- First boot with DB enabled auto-migrates legacy `bi_ops_snapshots` payload into normalized tables.
- File fallback via `BI_OPS_STORE_FILE` remains available for local/ephemeral runs.
- Auth/governance state persists in normalized `portal_*` tables.

## Core capabilities

- App-level RBAC/ABAC and EffectiveIdentity-based RLS for embed
- Dual auth: local username/password plus Microsoft AD OIDC SSO
- Role-based admin access via `portal-admin`; admin API keys are no longer part of the product UX
- AI agent orchestration with MCP + REST adapters
- Evidence-first Q&A, data transformation workflows, and chart generation
- Governance-first architecture with audit, reliability, and compliance hooks
- Legacy-proven BI administration flows:
  - user/role/report/page/rule permission assignments
  - favorite report handling
  - user import/export for enterprise onboarding
- Power BI metadata sync center:
  - full tenant/workspace scoped sync
  - sync run history and delta tracking (added/updated/removed)
  - dry-run mode before applying changes
  - diagnostics endpoint for OAuth/workspace/report/pages access troubleshooting
- DataMind UI/UX:
  - branded login and shell
  - auto-loaded report list/history
  - report detail auto-loads metadata and embed token

## Auth APIs

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/sso/start`
- `GET /api/auth/sso/callback`
- `POST /api/auth/session` (development helper only; disabled in production)

## Admin and operations APIs

- `GET|POST /api/admin/users`
- `GET|POST /api/admin/roles`
- `POST /api/admin/reports` (includes favorite toggle payload)
- `GET|POST /api/admin/permissions`
- `GET|POST /api/admin/import-export`
- `GET|POST /api/admin/sync`
- `GET /api/admin/sync/runs/[runId]`
- `GET /api/admin/sync/diagnostics?workspaceId=<workspace-guid>&reportId=<report-guid>`

All `/api/admin/*` routes require an authenticated session with the `portal-admin` role.

## Sync operations

- UI: `/admin/sync`
- History and workspace lists auto-load on entry; run history APIs are `no-store`.
- Tenant portal:
  - `/t/[tenantSlug]/dashboard`
  - `/t/[tenantSlug]/reports`
  - `/t/[tenantSlug]/agent`
  - `/t/[tenantSlug]/data-prep`
  - `/t/[tenantSlug]/chart-studio`
- Full sync payload:
  - `{"mode":"full","dryRun":false,"triggeredBy":"admin-api"}`
- Workspace sync payload:
  - `{"mode":"workspace","workspaceId":"<workspace-guid>","dryRun":true,"triggeredBy":"admin-api"}`
- If Power BI denies the report pages endpoint with `401/403`, sync still persists workspace/report/dataset metadata and records the pages warning instead of failing the whole run.
