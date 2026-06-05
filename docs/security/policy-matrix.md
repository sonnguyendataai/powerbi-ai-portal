# Policy Matrix

| Role | Read Data | Transform Data | Generate Chart | Mint Embed Token | Admin |
|---|---|---|---|---|---|
| `viewer` | allow | deny | deny | allow | deny |
| `analyst` | allow | allow | allow | allow | deny |
| `portal-admin` | allow | allow | allow | allow | allow |

## Mandatory checks

- Resource must always start with `tenant:{tenantId}:`.
- Deny-by-default when mapping role to RLS returns empty.
- Reject cross-tenant tool actions and cross-tenant embed requests.
- For legacy-style admin actions (assign report/page/rule, import/export users), only `portal-admin` can execute write operations.

## Authentication model

- Local username/password and Microsoft AD OIDC SSO both issue the unified `portal_session` cookie.
- `portal_tenant` is used for route-level tenant matching; authorization still comes from the signed session.
- Admin APIs are session/RBAC protected. `x-admin-api-key` is deprecated and must not be used in product UI.

## Power BI sync and embed diagnostics

- `portal-admin` can trigger `/api/admin/sync` and inspect `/api/admin/sync/runs`.
- `/api/admin/sync/diagnostics` is the first stop for Power BI OAuth/workspace/report/pages troubleshooting.
- Report pages endpoint `401/403` should not block report/dataset metadata sync; record warning and continue.
