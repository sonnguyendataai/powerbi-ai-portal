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
  - `src/llm-anthropic.ts` — Claude API wrapper with report-context-aware system prompt
  - `src/api-chat.ts` — thin wrapper with telemetry around `answerDataQuestion`
  - `src/bi-ops.ts` — in-memory BI operations service with PostgreSQL persistence
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
- Fast path triggered by passing `reportContext` to `/api/chat`. Frontend always sends context when viewing a specific report.
- `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` must be set for AI responses. If missing, a clear config message is returned (no silent mock fallback).

### Persistence
- `flushBiOpsPersistence()` is called before the sync route returns 202 to prevent "run_not_found" errors on serverless cold starts.

### TypeScript
- `exactOptionalPropertyTypes: true` — use `...(x ? { x } : {})` spread pattern for optional fields, not `x: undefined`.

### Theme / i18n
- `portal-theme` and `portal-locale` are the localStorage keys.
- `data-theme` attribute on `<html>` drives CSS variables. Add `suppressHydrationWarning` to `<html>` to avoid SSR mismatch.
