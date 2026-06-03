# Rollout Plan

## Stage 1 - Pilot

- Enable 1 workspace and 2 semantic models.
- Assign only analyst and viewer roles.
- Track evidence coverage and hallucination rate weekly.
- Enable admin APIs for user/role/report setup by BI admin team.

## Stage 2 - Department rollout

- Add approval flow for model-write tools.
- Enable chart studio and data prep APIs for analyst group.
- Monitor p95 latency and embed token failures by tenant.
- Migrate legacy permission artifacts (report-page-rule mappings) into `bi-operations` contracts.

## Stage 3 - Enterprise wide

- Enforce compliance exports and retention policies.
- Publish quarterly governance reviews.
- Enable cross-team KPI catalogs and centralized glossary.
- Use import/export APIs to onboard departments in controlled waves.
