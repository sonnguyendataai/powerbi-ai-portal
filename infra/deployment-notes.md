# Deployment Notes

- Deploy `apps/web` and `services/agent` with separate autoscaling policies.
- Keep secrets in cloud secret manager, never in `.env` committed files.
- Pin MCP endpoint configuration per environment with feature flags for preview APIs.
