# Security Policy

- Never store service principal secrets in repo.
- Validate every external input with schema guards.
- Deny cross-tenant access by default.
- Treat model and tool outputs as untrusted until validated.
- Authenticate users with `portal_session` from local credentials or Microsoft AD SSO; do not rely on caller-supplied identity headers in production.
- Admin APIs require `portal-admin`; do not add `x-admin-api-key` prompts back into product UI.
- Keep `SESSION_SIGNING_SECRET`, Power BI secrets, Azure AD secrets, and Supabase/Postgres credentials in platform secret storage only.
- Use distributed rate limiting for login/chat/embed/admin-sensitive endpoints when `DATABASE_URL` is configured.
