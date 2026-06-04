-- Normalized BI operations schema for Supabase/Postgres.
-- Keeps legacy snapshot table for backward compatibility and migration fallback.

create table if not exists bi_ops_snapshots (
  snapshot_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists bi_ops_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists bi_ops_users (
  id text primary key,
  email text not null,
  tenant_id text not null,
  role_ids jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '{}'::jsonb
);

create table if not exists bi_ops_roles (
  id text primary key,
  name text not null,
  is_required_rule boolean not null default false
);

create table if not exists bi_ops_rules (
  id text primary key,
  name text not null,
  table_name text not null,
  column_name text not null,
  values_json jsonb not null default '[]'::jsonb
);

create table if not exists bi_ops_workspaces (
  id text primary key,
  name text not null,
  display_name text not null,
  source_bi_id text not null,
  source_updated_at text,
  last_seen_at text,
  is_deleted boolean not null default false,
  content_hash text
);

create table if not exists bi_ops_datasets (
  id text primary key,
  workspace_id text not null,
  name text not null,
  source_bi_id text not null,
  source_updated_at text,
  last_seen_at text,
  is_deleted boolean not null default false,
  content_hash text
);

create table if not exists bi_ops_reports (
  id text primary key,
  workspace_id text not null,
  dataset_id text not null,
  name text not null,
  display_name text not null,
  embed_url text not null,
  page_ids jsonb not null default '[]'::jsonb,
  source_bi_id text,
  source_updated_at text,
  last_seen_at text,
  is_deleted boolean not null default false,
  content_hash text
);

create table if not exists bi_ops_pages (
  id text primary key,
  report_id text not null,
  name text not null,
  display_name text not null,
  source_bi_id text,
  source_updated_at text,
  last_seen_at text,
  is_deleted boolean not null default false,
  content_hash text
);

create table if not exists bi_ops_permissions (
  user_id text not null,
  report_id text not null,
  page_id text,
  rule_id text
);

create table if not exists bi_ops_favorites (
  user_id text not null,
  report_id text not null
);

create table if not exists bi_ops_sync_runs (
  id text primary key,
  mode text not null,
  workspace_id text,
  dry_run boolean not null default false,
  status text not null,
  started_at text not null,
  finished_at text,
  triggered_by text not null,
  error text,
  summary_counts jsonb not null default '{}'::jsonb
);

create table if not exists bi_ops_sync_delta_items (
  run_id text not null,
  entity_type text not null,
  entity_id text not null,
  workspace_id text,
  change_type text not null,
  before_hash text,
  after_hash text,
  metadata jsonb
);

create index if not exists idx_bi_ops_reports_workspace on bi_ops_reports (workspace_id);
create index if not exists idx_bi_ops_pages_report on bi_ops_pages (report_id);
create index if not exists idx_bi_ops_datasets_workspace on bi_ops_datasets (workspace_id);
create index if not exists idx_bi_ops_sync_runs_started on bi_ops_sync_runs (started_at desc);
create index if not exists idx_bi_ops_sync_delta_run on bi_ops_sync_delta_items (run_id);
