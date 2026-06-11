# Skill: powerbi-rest-agent

Use when querying Power BI semantic models through the REST API and DAX execution.

## Architecture

This portal uses **Power BI REST API directly** — not the `powerbi-modeling-mcp` server.
The `powerbi-modeling-mcp` server is a local stdio process for VS Code / developer machines.
It cannot be deployed as a server-side API dependency.

Primary agent path: service-principal OAuth → `POST /groups/{wsId}/datasets/{dsId}/executeQueries`

## executeQueries hard limits (Microsoft docs)

- **INFO functions are NOT supported** — `INFO.COLUMNS()`, `INFO.MEASURES()`, DMV queries all return errors.
- **One query per API call** — no batch.
- **100,000 rows or 1,000,000 values** max per query.
- **Service Principals are blocked** for datasets with RLS or SSO enabled.
- Requires tenant setting **"Dataset Execute Queries REST API"** to be enabled under Integration settings.
- Requires `Dataset.Read.All` or `Dataset.ReadWrite.All` scope on the service principal.

## Schema discovery

Because INFO functions are blocked, there is no REST API endpoint that returns column-level schema for imported/DirectQuery/Direct Lake datasets. The `/datasets/{id}/tables` endpoint only returns data for **Push datasets**.

**Workaround in this codebase:** `generateDaxQuery()` in `llm-anthropic.ts` generates a DAX query from the report name and question alone when schema is unavailable. Claude infers table/column names from domain context (HR = Employee table, headcount, turnover; Sales = Orders, Revenue, etc.).

## DAX result key format

`executeQueries` returns rows as `{ "TableName[ColumnName]": value }` for referenced columns,
and `{ "[AliasName]": value }` for SELECTCOLUMNS aliases. `cleanDaxKey()` in `agent-api.ts`
strips the table prefix to produce clean column names.

## Guidelines

- For content sync/debugging, use `/api/admin/sync/diagnostics` to inspect OAuth token claims.
- If the pages endpoint is denied while reports/datasets succeed, investigate report type and tenant settings — do not assume OAuth failure.
- DAX query failures from executeQueries include `error.pbi_error.details[0].detail.value` — surface this in evidence, not as a crash.
- Rate limit: 120 executeQueries requests per minute per user.
