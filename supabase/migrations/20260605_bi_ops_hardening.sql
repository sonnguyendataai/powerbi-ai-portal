-- Hardening migration for normalized BI ops schema.

alter table if exists bi_ops_permissions
  add constraint bi_ops_permissions_user_report_page_rule_unique
  unique nulls not distinct (user_id, report_id, page_id, rule_id);

alter table if exists bi_ops_favorites
  add constraint bi_ops_favorites_user_report_unique
  unique (user_id, report_id);

create index if not exists idx_bi_ops_permissions_user on bi_ops_permissions (user_id);
create index if not exists idx_bi_ops_permissions_report on bi_ops_permissions (report_id);
create index if not exists idx_bi_ops_sync_runs_status on bi_ops_sync_runs (status);
create index if not exists idx_bi_ops_sync_runs_mode_workspace on bi_ops_sync_runs (mode, workspace_id);

alter table if exists bi_ops_sync_runs
  add constraint bi_ops_sync_runs_mode_check
  check (mode in ('full', 'workspace'));

alter table if exists bi_ops_sync_runs
  add constraint bi_ops_sync_runs_status_check
  check (status in ('running', 'succeeded', 'failed'));

alter table if exists bi_ops_sync_delta_items
  add constraint bi_ops_sync_delta_items_change_type_check
  check (change_type in ('added', 'updated', 'removed'));
