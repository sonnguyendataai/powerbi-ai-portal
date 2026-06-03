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
