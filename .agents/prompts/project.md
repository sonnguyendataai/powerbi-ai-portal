# Project Prompt

This project implements a Power BI AI Portal in app-owns-data mode.

Context requirements:
- Use portal RBAC/ABAC and EffectiveIdentity RLS mapping.
- Use Power BI MCP/Fabric MCP first, then fallback to REST adapters.
- Emit audit records for embed token mint, tool calls, and chart generation.
- Preserve enterprise BI admin operations (user/role/report/page/rule, favorites, import/export) while adding AI-first workflows.
