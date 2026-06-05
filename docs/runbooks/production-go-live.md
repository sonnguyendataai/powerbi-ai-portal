# Production Go-Live Checklist

## 1) Environment and secrets

- Set `APP_ENV=prod`.
- Provision `POWERBI_TENANT_ID`, `POWERBI_CLIENT_ID`, `POWERBI_CLIENT_SECRET`.
- Set `SESSION_SIGNING_SECRET` (minimum 24 chars).
- Set `APP_BASE_URL`.
- Set local bootstrap credentials for the first admin:
  - `LOCAL_AUTH_BOOTSTRAP_USERNAME`
  - `LOCAL_AUTH_BOOTSTRAP_PASSWORD`
  - `LOCAL_AUTH_BOOTSTRAP_TENANT_ID`
- If using Microsoft AD SSO, set `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_REDIRECT_URI`.
- Ensure secrets are stored in platform secret manager, not repo.

## 2) Platform health checks

- Configure liveness probe: `GET /api/health`.
- Configure readiness probe: `GET /api/ready`.
- Fail deployment if readiness returns `503`.

## 3) Security guardrails

- Confirm `/login` supports local username/password and Microsoft AD SSO entry.
- Confirm admin APIs reject users without `portal-admin`.
- Confirm end-user APIs require valid `portal_session` cookie or bearer session token.
- Verify chat and embed token rate limits in load tests.
- Confirm response headers include anti-clickjacking and nosniff policies.

## 4) Release quality gates

- CI must pass:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm --filter @portal/web build`
- Perform smoke tests:
  - embed token issuance
  - AI chat response with evidence
  - admin user/role/report permission APIs
  - admin sync run (`POST /api/admin/sync`) and run detail retrieval (`GET /api/admin/sync/runs/:runId`)
  - Power BI sync diagnostics (`GET /api/admin/sync/diagnostics?workspaceId=...&reportId=...`)

## 5) Post-release monitoring

- Track 5xx rates on `/api/chat`, `/api/embed/token`, `/api/admin/*`.
- Track p95 latency for chat and embed token routes.
- Track rate-limit hit ratios for anomaly detection.
- Track sync outcome ratio (`succeeded/failed`) and delta volume trend for metadata drift detection.

## 6) Vercel specifics

- Confirm GitHub Actions has `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Verify `vercel.json` build/install commands are in effect.
- For Supabase/Postgres mode, verify normalized `bi_ops_*` tables exist after first boot.
- Verify `portal_*` auth tables exist and first admin user is bootstrapped.
- For file-backed fallback in serverless mode, use `/tmp/bi-ops.json`.

## 7) Sync operations checklist

- Use `/admin/sync` for manual trigger in emergency runbook flows.
- Run one dry-run sync before enabling scheduled sync jobs.
- Keep `triggeredBy` field consistent (`admin-api`, `sync-center`, or scheduler ID) for audit clarity.
- Schedule retention pruning job: `select prune_bi_ops_sync_history(90);`.
- If report pages endpoint fails with `401/403`, inspect `/api/admin/sync/diagnostics` before changing permissions. Sync still stores workspace/report/dataset metadata while pages remain empty for affected reports.
