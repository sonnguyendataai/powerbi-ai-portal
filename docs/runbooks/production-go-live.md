# Production Go-Live Checklist

## 1) Environment and secrets

- Set `APP_ENV=prod`.
- Provision `POWERBI_TENANT_ID`, `POWERBI_CLIENT_ID`, `POWERBI_CLIENT_SECRET`.
- Set `PORTAL_ADMIN_API_KEY` (minimum 16 chars, recommended 32+).
- Set `SESSION_SIGNING_SECRET` (minimum 24 chars).
- Ensure secrets are stored in platform secret manager, not repo.

## 2) Platform health checks

- Configure liveness probe: `GET /api/health`.
- Configure readiness probe: `GET /api/ready`.
- Fail deployment if readiness returns `503`.

## 3) Security guardrails

- Confirm admin APIs require `x-admin-api-key`.
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

## 5) Post-release monitoring

- Track 5xx rates on `/api/chat`, `/api/embed/token`, `/api/admin/*`.
- Track p95 latency for chat and embed token routes.
- Track rate-limit hit ratios for anomaly detection.
- Track sync outcome ratio (`succeeded/failed`) and delta volume trend for metadata drift detection.

## 6) Vercel specifics

- Confirm GitHub Actions has `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Verify `vercel.json` build/install commands are in effect.
- For Supabase/Postgres mode, verify normalized `bi_ops_*` tables exist after first boot.
- For file-backed fallback in serverless mode, use `/tmp/bi-ops.json`.

## 7) Sync operations checklist

- Use `/admin/sync` for manual trigger in emergency runbook flows.
- Run one dry-run sync before enabling scheduled sync jobs.
- Keep `triggeredBy` field consistent (`admin-api`, `sync-center`, or scheduler ID) for audit clarity.
- Schedule retention pruning job: `select prune_bi_ops_sync_history(90);`.
