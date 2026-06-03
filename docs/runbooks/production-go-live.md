# Production Go-Live Checklist

## 1) Environment and secrets

- Set `APP_ENV=prod`.
- Provision `POWERBI_TENANT_ID`, `POWERBI_CLIENT_ID`, `POWERBI_CLIENT_SECRET`.
- Set `PORTAL_ADMIN_API_KEY` (minimum 16 chars, recommended 32+).
- Ensure secrets are stored in platform secret manager, not repo.

## 2) Platform health checks

- Configure liveness probe: `GET /api/health`.
- Configure readiness probe: `GET /api/ready`.
- Fail deployment if readiness returns `503`.

## 3) Security guardrails

- Confirm admin APIs require `x-admin-api-key`.
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

## 5) Post-release monitoring

- Track 5xx rates on `/api/chat`, `/api/embed/token`, `/api/admin/*`.
- Track p95 latency for chat and embed token routes.
- Track rate-limit hit ratios for anomaly detection.
