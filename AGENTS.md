# AGENTS.md

## Project Overview

`pbi-ai-portal` is an enterprise AI analytics portal for Power BI using an app-owns-data embedding model. The portal provides:

- AI Q&A grounded in governed enterprise data
- Data preparation assistance with policy checks
- Natural-language chart generation and embedded Power BI visualization
- Enterprise BI operations inherited from the legacy portal:
  - role-based report/page/rule administration
  - user report permissions and favorites
  - user import/export administration workflows

## Non-negotiables

- Never commit secrets.
- No `any` in TypeScript.
- Tenant isolation is mandatory for every data and tool operation.
- Every tool call must pass policy validation before execution.
- Keep model and tool integrations provider-agnostic through adapters.
- Production deploys must pass CI typecheck/test/build gates.

## Repository Layout

- `apps/web` - portal UI and API routes
  - `src/agent-api.ts` — AI Q&A orchestration; calls PBI REST API directly; fast/slow path based on `reportContext`
  - `src/powerbi-schema.ts` — **shared** Power BI helper: service-principal auth, `executeQueries`, error extraction (`extractPbiErrorMessage`), and live schema discovery (`fetchDatasetSchema` via `INFO.VIEW.*`). Used by `agent-api.ts`, `chart-studio.ts`, `data-prep.ts`
  - `src/llm-anthropic.ts` — Claude API wrapper: report-context-aware answers, DAX generation, chart-spec generation, and data-prep-plan generation (JSON-output helpers)
  - `src/chart-studio.ts` / `src/data-prep.ts` — Anthropic-backed, schema-grounded chart-spec and transform-plan generators (async; require `ANTHROPIC_API_KEY`). `chart-studio.ts` with `create=true` builds a PBIR report and creates it via the Fabric API
  - `src/pbir-builder.ts` — assembles a minimal PBIR report definition (definition.pbir `byConnection`, report/page/visual JSON) and calls the Fabric Create Report API (handles the 202 long-running operation)
  - `src/api-chat.ts` / `src/api-chart.ts` / `src/api-data-prep.ts` — thin telemetry wrappers around the generators
  - `src/bi-ops.ts` — in-memory BI operations service with PostgreSQL persistence; `reloadBiOperationsService()` reloads the snapshot from DB on a cache miss (fixes cross-instance `run_not_found`)
  - `src/bi-ops-persistence.ts` — DB read/write for `bi_ops_*` tables; must be `await`-ed before sync response
  - `src/embed-api.ts` — embed token generation (omits `identities` when no RLS roles)
  - `src/components/ThemeLanguageProvider.tsx` — dark/light + EN/VI toggle, `localStorage` persistence
  - `src/components/TenantSidebar.tsx` — sidebar + topbar with i18n support
  - `src/i18n.ts` — EN/VI translation dictionary
  - `src/app/t/[tenantSlug]/reports/[reportId]/page.tsx` — report embed (two-phase SDK pattern) + inline AI chat
- `services/agent` - orchestration runtime and provider adapters
- `services/memory` - durable memory and retrieval services
- `packages/agent-core` - policy engine, contracts, and orchestration primitives
- `packages/mcp-tools` - MCP tool registries and allowlists
- `packages/powerbi-embedded` - embed token and effective identity helpers
  - `src/token-service.ts` — conditionally includes `identities` only when RLS roles are present
- `packages/bi-operations` - legacy-grade BI user/role/report/rule/page operations
- `docs/architecture` - architecture and ADR docs
- `docs/runbooks` - rollout, hardening, and production go-live procedures
- `.agents` - reusable prompts, modes, skills, policies, and eval assets

## Critical implementation notes

### Power BI embed
- Use `powerbi-client` SDK from jsDelivr CDN (`https://cdn.jsdelivr.net/npm/powerbi-client@2.23.10/dist/powerbi.min.js`). Never use a bare `<iframe src>`.
- Call `pbi.embed(container, config)` inside `useEffect([embedData])` — not in the same render cycle as the state update that made the container visible.
- Use `visibility: hidden/visible` on the container (not `display: none`) so SDK can always measure dimensions.
- `tokenType: 1` = Embed token. `background: 1` = Transparent.
- Omit `identities` entirely (not empty array) when dataset has no RLS.

### AI Analyst
- `POWERBI_MCP_URL` / `FABRIC_CORE_MCP_URL` are not configured in production — the agent uses Power BI REST API directly.
- Fast path triggered by passing `reportContext` to `/api/chat`. Frontend always sends context when viewing a specific report. `/agent` and `/chart-studio` expose a scope selector that sends `reportContext` / workspace+dataset; `/data-prep` sends `workspaceId`.
- `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` must be set for AI responses (chat, chart, data-prep). If missing, a clear config error is returned/thrown (no silent mock fallback).

### Power BI schema & DAX (`src/powerbi-schema.ts`)
- Schema discovery uses the **DAX `INFO.VIEW.COLUMNS()` / `INFO.VIEW.MEASURES()`** functions through `executeQueries`. Do NOT use `INFO.COLUMNS` / `INFO.MEASURES` / DMV — `executeQueries` blocks them ("INFO functions and DMV queries are not supported"). The `INFO.VIEW.*` variants are real DAX and execute. Falls back to REST `/tables` (Push datasets only) when `INFO.VIEW.*` returns nothing.
- REST `/datasets/{id}/tables` alone returns empty for imported/DirectQuery/Direct Lake models — never rely on it as the primary schema source, or the model will guess table names (e.g. `Date`).
- Keep hidden columns/measures (date dims and keys are often hidden); drop only the internal `RowNumber` column.
- The `executeQueries` error envelope nests its message under the key `"pbi.error"` (a literal dot, NOT `pbi_error`). Use `extractPbiErrorMessage`; it reads the longest detail value and appends the generic code. A bad DAX query retries once with the real error fed back.

### Report creation (`src/pbir-builder.ts`)
- "Create report" uses the **Fabric** Items API (`POST https://api.fabric.microsoft.com/v1/workspaces/{id}/reports`), NOT the Power BI REST API — the latter has no "create report with layout" operation (only Clone/Rebind/Update Report Content).
- Use `fetchFabricToken` (scope `https://api.fabric.microsoft.com/.default`), a separate token from the Power BI one. Same service principal works but it must be a workspace **Contributor** with Fabric scopes granted.
- Reports are built in **PBIR** format. REST deployment requires a `byConnection` `datasetReference`; only `semanticmodelid=<id>` is needed in the connection string. Parts are base64-encoded into `definition.parts[]`.
- Create returns 201 (sync) or 202 (long-running operation) — poll the `Location` operation URL until `Succeeded`, then read `/result` for the new report id.
- Requires Fabric/Premium/PPU capacity. On shared capacity the API errors; surface it verbatim rather than pretending success.

### Persistence
- `flushBiOpsPersistence()` is called before the sync route returns 202 to prevent "run_not_found" errors on serverless cold starts (write side).
- `BiOperationsService.runInBatch(fn)` wraps a multi-upsert operation (e.g. full sync) so it persists **once** at the end. Each `upsert*` otherwise rewrites the entire snapshot (TRUNCATE + reinsert 11 tables) — O(N) rewrites that cause a 504 on large syncs.
- The in-memory service is cached per warm serverless instance and does not auto-reload. On a sync-run cache miss, the run-detail route calls `reloadBiOperationsService()` (reload snapshot from DB) before returning 404 — fixes cross-instance `run_not_found` (read side).

### TypeScript
- `exactOptionalPropertyTypes: true` — use `...(x ? { x } : {})` spread pattern for optional fields, not `x: undefined`.

### Theme / i18n
- `portal-theme` and `portal-locale` are the localStorage keys.
- `data-theme` attribute on `<html>` drives CSS variables. Add `suppressHydrationWarning` to `<html>` to avoid SSR mismatch.
