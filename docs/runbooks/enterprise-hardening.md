# Enterprise Hardening Runbook

## Reliability

- Define `SLO` for embed token latency, chat p95 latency, and tool error rate.
- Add synthetic checks for Power BI token generation and MCP availability.
- Add synthetic checks for local login, Microsoft AD SSO callback, and `/admin/sync` history auto-load.
- Apply circuit breaker and retry policy on MCP/REST adapters.
- Wire platform probes to `GET /api/health` and `GET /api/ready`.
- Use `/api/admin/sync/diagnostics` to capture Power BI token claims and per-endpoint REST status before escalating permission issues.

## FinOps

- Track token mint count per tenant per day.
- Track MCP tool-call volume and average response size.
- Track LLM token usage by route and user persona.

## Compliance

- Export audit logs to SIEM daily.
- Enforce retention windows for episodic memory and chat traces.
- Enforce retention for sync runs/delta with `prune_bi_ops_sync_history`.
- Maintain region-bound data flow policy for EMEA/APAC tenants.
- Review `portal_*` auth tables and `bi_ops_*` operations tables for least-privilege access in Supabase/Postgres.

## Delivery controls

- Enforce CI gates in `.github/workflows/ci.yml` before merge.
- Block release if typecheck, tests, or web build fail.
- Block release if login, role-based admin, sync diagnostics, and report auto-load smoke tests fail.
