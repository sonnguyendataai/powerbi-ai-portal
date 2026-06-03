# Enterprise Hardening Runbook

## Reliability

- Define `SLO` for embed token latency, chat p95 latency, and tool error rate.
- Add synthetic checks for Power BI token generation and MCP availability.
- Apply circuit breaker and retry policy on MCP/REST adapters.
- Wire platform probes to `GET /api/health` and `GET /api/ready`.

## FinOps

- Track token mint count per tenant per day.
- Track MCP tool-call volume and average response size.
- Track LLM token usage by route and user persona.

## Compliance

- Export audit logs to SIEM daily.
- Enforce retention windows for episodic memory and chat traces.
- Maintain region-bound data flow policy for EMEA/APAC tenants.

## Delivery controls

- Enforce CI gates in `.github/workflows/ci.yml` before merge.
- Block release if typecheck, tests, or web build fail.
