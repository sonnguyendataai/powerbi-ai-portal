# Skill: powerbi-embed

Use when generating embed token bundles for Power BI reports.

Steps:
1. Validate request payload and tenant context.
2. Map portal roles to semantic-model RLS roles.
3. Request embed token with effective identity.
4. Emit audit events for denied and issued cases.

Current implementation notes:

- Report detail pages auto-load report metadata and request an embed token; do not require separate `Load report` or `Mint token` buttons.
- `/api/embed/token` returns `embedToken`, `embedUrl`, and `expiresAt`; frontend must read `embedToken`, not `token`.
- Power BI REST errors should surface response body and request id for debugging.
- If metadata calls return `400/401/403`, verify workspace/report/dataset ids from synced `bi_ops_reports` and use `/api/admin/sync/diagnostics` for endpoint-by-endpoint checks.
