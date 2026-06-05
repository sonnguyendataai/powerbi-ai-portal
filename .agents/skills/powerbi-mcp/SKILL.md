# Skill: powerbi-mcp

Use when querying or modeling Power BI semantic models through MCP tools.

Guidelines:
- Prefer read tools first for analytical Q&A.
- Confirm tool allowlist before invocation.
- Include provenance and tool evidence in final answer.
- Fallback to REST adapter when MCP capability is unavailable.
- For content sync/debugging, use REST diagnostics (`/api/admin/sync/diagnostics`) to inspect OAuth token claims and workspace/report/pages access.
- If Power BI pages endpoint is denied while reports/datasets are accessible, do not assume OAuth failure; preserve report metadata and investigate report type, tenant settings, workspace role, and Power BI request id.
