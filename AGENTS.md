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
- `services/agent` - orchestration runtime and provider adapters
- `services/memory` - durable memory and retrieval services
- `packages/agent-core` - policy engine, contracts, and orchestration primitives
- `packages/mcp-tools` - MCP tool registries and allowlists
- `packages/powerbi-embedded` - embed token and effective identity helpers
- `packages/bi-operations` - legacy-grade BI user/role/report/rule/page operations
- `docs/architecture` - architecture and ADR docs
- `docs/runbooks` - rollout, hardening, and production go-live procedures
- `.agents` - reusable prompts, modes, skills, policies, and eval assets
