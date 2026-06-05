-- Helper function for sync history retention.

create or replace function prune_bi_ops_sync_history(retain_days int default 90)
returns int
language plpgsql
as $$
declare
  deleted_runs int := 0;
begin
  with old_runs as (
    select id
    from bi_ops_sync_runs
    where started_at::timestamptz < now() - make_interval(days => retain_days)
  )
  delete from bi_ops_sync_delta_items
  where run_id in (select id from old_runs);

  with old_runs as (
    select id
    from bi_ops_sync_runs
    where started_at::timestamptz < now() - make_interval(days => retain_days)
  )
  delete from bi_ops_sync_runs
  where id in (select id from old_runs);

  get diagnostics deleted_runs = row_count;
  return deleted_runs;
end;
$$;
