# Compliance Checklist

- [ ] Audit logs exported to immutable storage.
- [ ] Tenant boundary tests pass in CI.
- [ ] Local username/password and Microsoft AD SSO both issue signed `portal_session` cookies.
- [ ] Admin routes and APIs reject users without `portal-admin`.
- [ ] RLS role mapping contract tests pass.
- [ ] Secret rotation documented and rehearsed.
- [ ] Data retention jobs configured for memory, traces, sync runs, and sync delta.
- [ ] Power BI diagnostics endpoint access is restricted to `portal-admin`.
- [ ] Report list/detail pages avoid manual loading steps and expose actionable errors.
- [ ] Incident response runbook reviewed in last 90 days.
