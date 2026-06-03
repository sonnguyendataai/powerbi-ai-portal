# Vercel Deployment Runbook

## 1) Create Vercel project

- Import repository: `sonnguyendataai/powerbi-ai-portal`.
- Framework: Next.js.
- Root directory: `.` (monorepo root, build command already scoped to `@portal/web` in `vercel.json`).

## 2) Required environment variables

Set these in Vercel for `Preview` and `Production`:

- `APP_ENV` (`staging` for preview, `prod` for production)
- `POWERBI_TENANT_ID`
- `POWERBI_CLIENT_ID`
- `POWERBI_CLIENT_SECRET`
- `POWERBI_API_BASE_URL` (default: `https://api.powerbi.com/v1.0/myorg`)
- `PORTAL_ADMIN_API_KEY`
- `BI_OPS_STORE_FILE` (for ephemeral file mode use `/tmp/bi-ops.json`)
- `CHAT_RATE_LIMIT_PER_MIN`
- `EMBED_RATE_LIMIT_PER_MIN`
- Optional: `POWERBI_MCP_URL`, `FABRIC_CORE_MCP_URL`

## 3) GitHub Actions secrets

Add repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Workflow:

- `.github/workflows/vercel-deploy.yml`
- Push to `cursor/*` -> preview deploy
- Push/merge to `main` -> production deploy

## 4) Post-deploy smoke checks

- `GET /api/health` returns `200`.
- `GET /api/ready` returns `200`.
- `POST /api/embed/token` succeeds for a test tenant/report.
- `POST /api/chat` returns answer and evidence.
- `GET /api/admin/users` requires valid `x-admin-api-key`.
