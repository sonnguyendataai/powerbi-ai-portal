# Skill: powerbi-embed

Use when generating embed token bundles for Power BI reports.

Steps:
1. Validate request payload and tenant context.
2. Map portal roles to semantic-model RLS roles.
3. Request embed token with effective identity.
4. Emit audit events for denied and issued cases.
