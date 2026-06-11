# Target State

The portal is composed of:

- web app (`apps/web`) for user workflows and embedding
- dual auth layer: local username/password (scrypt) and Microsoft AD OIDC SSO (PKCE), unified into HMAC `portal_session` cookie
- AI chat API (`/api/chat` → `agent-api.ts` → `llm-anthropic.ts`): calls Power BI REST API directly with service-principal OAuth; no external MCP servers required
- reusable packages for policy (`packages/agent-core`), embed tokens (`packages/powerbi-embedded`), and BI operations (`packages/bi-operations`)
- normalized PostgreSQL persistence: `portal_*` tables for auth/governance, `bi_ops_*` tables for operational metadata
- theme and i18n: dark/light + EN/VI toggles via `ThemeLanguageProvider`, persisted in `localStorage`

## Embed architecture

Power BI embed requires the `powerbi-client` JS SDK (loaded from jsDelivr CDN at runtime). The SDK injects the embed token into the iframe via postMessage — a plain `<iframe src=embedUrl>` shows the Power BI login wall and does not work.

Report page uses a two-phase pattern:
1. Fetch report metadata + embed token → store in `embedData` state
2. `useEffect([embedData])` fires after React commits DOM → calls `pbi.embed(container, config)`

Container uses `visibility: hidden/visible` (not `display:none`) so SDK can always measure dimensions.

RLS: `identities` must be **completely absent** from the GenerateToken request body when the dataset has no RLS configured. Sending an empty array or any identity object causes a 400 `InvalidRequest`.

## AI Analyst architecture

`/api/chat` → `postChat()` → `answerDataQuestion()` → Power BI REST → `generateAnthropicAnswer()` → Claude

Fast path (when `reportContext` is provided by caller):
- Skip tenant-wide enumeration
- Attempt schema via `GET /groups/{workspaceId}/datasets/{datasetId}/tables` (only returns data for Push datasets; empty for imported/DirectQuery/Direct Lake — this is expected)
- Get last refresh status via `GET /groups/{workspaceId}/datasets/{datasetId}/refreshes?$top=1`
- Generate a DAX query via Claude using report name + question as context (schema used when available, inferred from domain when not)
- Execute DAX via `POST /groups/{workspaceId}/datasets/{datasetId}/executeQueries` — returns real data rows
- NOTE: INFO.COLUMNS/INFO.MEASURES/DMV are NOT supported by executeQueries per Microsoft docs; do not attempt them

Slow path (no context): reads portal store + calls `/v1.0/myorg/datasets` and `/reports`

Inline AI chat is embedded in the report detail page and auto-sends `reportContext` on every message.

## Persistence pattern

`flushBiOpsPersistence()` must be awaited before returning the sync API response. Without this, serverless instances that start cold after the response return find no record in the DB (fire-and-forget DB write races the cold-start reload).

## Design goals

- Replaceable LLM providers (configured via `ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY`)
- No external MCP servers required at runtime (REST fallback is the primary path)
- Role-governed admin workflows with no UI contract changes
- Full TypeScript strict mode with `exactOptionalPropertyTypes: true`

## Current product contracts

- `/login` is the DataMind-branded entry point.
- `/t/[tenantSlug]/*` routes are tenant-scoped and require a matching session.
- `/admin/*` requires `portal-admin`; `x-admin-api-key` is deprecated and must not be reintroduced.
- Power BI sync auto-loads run history/workspaces; expose diagnostics for OAuth/workspace/report/pages access.
- Report list/detail screens auto-load; avoid requiring users to press `Load` for existing content.
- Report detail shows embedded report + inline AI chat panel; no internal IDs (datasetId, workspaceId) shown in the UI.
