# AGENTS.md

## Project Overview

`pbi-ai-portal` is an enterprise AI analytics portal for Power BI using an app-owns-data embedding model. The portal provides:

- AI Q&A grounded in governed enterprise data
- Data preparation assistance with policy checks
- Natural-language chart generation and embedded Power BI visualization

## Non-negotiables

- Never commit secrets.
- No `any` in TypeScript.
- Tenant isolation is mandatory for every data and tool operation.
- Every tool call must pass policy validation before execution.
- Keep model and tool integrations provider-agnostic through adapters.

## Repository Layout

- `apps/web` - portal UI and API routes
- `services/agent` - orchestration runtime and provider adapters
- `services/memory` - durable memory and retrieval services
- `packages/agent-core` - policy engine, contracts, and orchestration primitives
- `packages/mcp-tools` - MCP tool registries and allowlists
- `packages/powerbi-embedded` - embed token and effective identity helpers
- `docs/architecture` - architecture and ADR docs
- `.agents` - reusable prompts, modes, skills, policies, and eval assets
