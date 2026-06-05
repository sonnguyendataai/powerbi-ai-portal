# Rollout Plan

## Stage 1 - Pilot

- Enable 1 workspace and 2 semantic models.
- Configure local bootstrap admin and, if available, Microsoft AD SSO.
- Assign only analyst and viewer roles.
- Validate DataMind-branded login, tenant dashboard, reports auto-load, and admin sync history auto-load.
- Track evidence coverage and hallucination rate weekly.
- Enable role-based admin console for user/role/report setup by BI admin team.
- Run `/api/admin/sync/diagnostics` for the pilot workspace/report before first scheduled sync.

## Stage 2 - Department rollout

- Add approval flow for model-write tools.
- Enable chart studio and data prep APIs for analyst group.
- Monitor p95 latency and embed token failures by tenant.
- Monitor Power BI metadata/report/pages failures using diagnostics request ids.
- Migrate legacy permission artifacts (report-page-rule mappings) into `bi-operations` contracts.

## Stage 3 - Enterprise wide

- Enforce compliance exports and retention policies.
- Publish quarterly governance reviews.
- Enable cross-team KPI catalogs and centralized glossary.
- Use import/export APIs to onboard departments in controlled waves.
- Enforce Microsoft AD SSO as preferred login while retaining local break-glass admin accounts.
