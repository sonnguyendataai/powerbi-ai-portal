-- Dual-provider auth schema: local credentials + Microsoft AD identities.

create table if not exists portal_users (
  id text primary key,
  username text not null unique,
  tenant_id text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists portal_user_credentials (
  user_id text primary key references portal_users(id) on delete cascade,
  password_hash text not null,
  password_updated_at timestamptz not null default now(),
  failed_attempts int not null default 0,
  locked_until timestamptz
);

create table if not exists portal_user_roles (
  user_id text not null references portal_users(id) on delete cascade,
  tenant_id text not null,
  role text not null,
  primary key (user_id, tenant_id, role),
  check (role in ('portal-admin', 'analyst', 'viewer'))
);

create table if not exists portal_auth_audit (
  id text primary key,
  user_id text,
  provider text not null,
  action text not null,
  success boolean not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_users_tenant on portal_users (tenant_id);
create index if not exists idx_portal_auth_audit_created on portal_auth_audit (created_at desc);
