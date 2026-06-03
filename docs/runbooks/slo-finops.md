# SLO and FinOps Baseline

## SLO

- Embed token API success rate >= 99.9%
- Chat answer API p95 latency <= 6 seconds
- MCP tool-call failure rate <= 2%

## FinOps metrics

- `embed_tokens_issued_total` by tenant
- `llm_input_tokens_total` and `llm_output_tokens_total` by feature
- `mcp_tool_calls_total` by tool and outcome
- `chart_generation_requests_total` by role and tenant
