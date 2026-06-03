# Architecture Overview

## Target system

```mermaid
flowchart LR
  user[BusinessUser] --> portal[apps/web]
  portal --> appAuth[PortalSSOAuth]
  portal --> embedApi[EmbedTokenAPI]
  portal --> chatApi[AgentQueryAPI]
  chatApi --> orchestrator[services/agent]
  orchestrator --> policy[packages/agent-core]
  orchestrator --> mcpTools[packages/mcp-tools]
  orchestrator --> powerbiMcp[PowerBIMCP]
  orchestrator --> fabricMcp[FabricCoreMCP]
  embedApi --> embedSvc[packages/powerbi-embedded]
  embedSvc --> pbiRest[PowerBIREST]
  embedApi --> rls[EffectiveIdentityRLS]
  rls --> pbiSemantic[PowerBISemanticModel]
  orchestrator --> memory[services/memory]
  policy --> audit[AuditLogs]
```

## Key contracts

- App-owns-data embedding with service principal and per-request embed token.
- App-level RBAC/ABAC controls every tool invocation and token mint action.
- Effective identity roles map from portal roles to semantic model RLS roles.
- Tool layer is adapter-based to support MCP preview churn and REST fallback.
