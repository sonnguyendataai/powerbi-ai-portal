import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import type { BiOpsStoreSnapshot } from "@portal/bi-operations";

const SNAPSHOT_KEY = "global";
const MIGRATION_VERSION = "biops_normalized_v1";

// Singleton pool — reused across requests to avoid connection exhaustion
const pools = new Map<string, ReturnType<typeof postgres>>();
function getPool(databaseUrl: string): ReturnType<typeof postgres> {
  let pool = pools.get(databaseUrl);
  if (!pool) {
    pool = postgres(databaseUrl, { max: 5, idle_timeout: 30 });
    pools.set(databaseUrl, pool);
  }
  return pool;
}

export async function loadBiOpsSnapshot(
  opts: { filePath: string; databaseUrl?: string },
): Promise<BiOpsStoreSnapshot | undefined> {
  if (opts.databaseUrl) {
    const dbSnapshot = await loadFromDatabase(opts.databaseUrl, opts.filePath);
    if (dbSnapshot) {
      return dbSnapshot;
    }
  }
  return readFromFile(opts.filePath);
}

export function persistBiOpsSnapshot(
  opts: { filePath: string; databaseUrl?: string },
  snapshot: BiOpsStoreSnapshot,
): void {
  writeToFile(opts.filePath, snapshot);
  if (opts.databaseUrl) {
    writeToDatabase(opts.databaseUrl, snapshot).catch((err) => {
      console.error("[bi-ops-persistence] DB write failed:", err instanceof Error ? err.message : err);
    });
  }
}

async function loadFromDatabase(databaseUrl: string, filePath: string): Promise<BiOpsStoreSnapshot | undefined> {
  const sql = getPool(databaseUrl);
  try {
    await ensureSchema(sql);
    await migrateFromSnapshotIfNeeded(sql, filePath);

    const normalized = await loadNormalizedSnapshot(sql);
    if (hasMeaningfulData(normalized)) {
      return normalized;
    }

    const fallbackRows = await sql<{ payload: unknown }[]>`
      select payload from bi_ops_snapshots where snapshot_key = ${SNAPSHOT_KEY}
    `;
    if (fallbackRows.length === 0) {
      return undefined;
    }
    return fallbackRows[0]?.payload as BiOpsStoreSnapshot;
  } catch {
    return undefined;
  }
}

async function writeToDatabase(databaseUrl: string, snapshot: BiOpsStoreSnapshot): Promise<void> {
  const sql = getPool(databaseUrl);
  await ensureSchema(sql);
  await persistNormalizedSnapshot(sql, snapshot);
  const snapshotJson = JSON.stringify(snapshot);
  await sql`insert into bi_ops_snapshots (snapshot_key, payload, updated_at)
            values (${SNAPSHOT_KEY}, ${snapshotJson}::jsonb, now())
            on conflict (snapshot_key)
            do update set payload = excluded.payload, updated_at = now()`;
}

function readFromFile(filePath: string): BiOpsStoreSnapshot | undefined {
  try {
    const raw = readFileSync(resolve(process.cwd(), filePath), "utf8");
    return JSON.parse(raw) as BiOpsStoreSnapshot;
  } catch {
    return undefined;
  }
}

function writeToFile(filePath: string, snapshot: BiOpsStoreSnapshot): void {
  try {
    const absolutePath = resolve(process.cwd(), filePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  } catch {
    // no-op
  }
}

async function ensureSchema(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql`
    create table if not exists bi_ops_snapshots (
      snapshot_key text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create table if not exists bi_ops_meta (
    key text primary key,
    value text not null,
    updated_at timestamptz not null default now()
  )`;
  await sql`create table if not exists bi_ops_users (
    id text primary key,
    email text not null,
    tenant_id text not null,
    role_ids jsonb not null default '[]'::jsonb,
    custom_fields jsonb not null default '{}'::jsonb
  )`;
  await sql`create table if not exists bi_ops_roles (
    id text primary key,
    name text not null,
    is_required_rule boolean not null default false
  )`;
  await sql`create table if not exists bi_ops_rules (
    id text primary key,
    name text not null,
    table_name text not null,
    column_name text not null,
    values_json jsonb not null default '[]'::jsonb
  )`;
  await sql`create table if not exists bi_ops_workspaces (
    id text primary key,
    name text not null,
    display_name text not null,
    source_bi_id text not null,
    source_updated_at text,
    last_seen_at text,
    is_deleted boolean not null default false,
    content_hash text
  )`;
  await sql`create table if not exists bi_ops_datasets (
    id text primary key,
    workspace_id text not null,
    name text not null,
    source_bi_id text not null,
    source_updated_at text,
    last_seen_at text,
    is_deleted boolean not null default false,
    content_hash text
  )`;
  await sql`create table if not exists bi_ops_reports (
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
  )`;
  await sql`create table if not exists bi_ops_pages (
    id text primary key,
    report_id text not null,
    name text not null,
    display_name text not null,
    source_bi_id text,
    source_updated_at text,
    last_seen_at text,
    is_deleted boolean not null default false,
    content_hash text
  )`;
  await sql`create table if not exists bi_ops_permissions (
    user_id text not null,
    report_id text not null,
    page_id text,
    rule_id text
  )`;
  await sql`create table if not exists bi_ops_favorites (
    user_id text not null,
    report_id text not null
  )`;
  await sql`create table if not exists bi_ops_sync_runs (
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
  )`;
  await sql`create table if not exists bi_ops_sync_delta_items (
    run_id text not null,
    entity_type text not null,
    entity_id text not null,
    workspace_id text,
    change_type text not null,
    before_hash text,
    after_hash text,
    metadata jsonb
  )`;
}

async function migrateFromSnapshotIfNeeded(sql: ReturnType<typeof postgres>, filePath: string): Promise<void> {
  const migration = await sql<{ value: string }[]>`select value from bi_ops_meta where key = 'schema_version'`;
  if (migration[0]?.value === MIGRATION_VERSION) {
    return;
  }

  const normalized = await loadNormalizedSnapshot(sql);
  if (hasMeaningfulData(normalized)) {
    await sql`insert into bi_ops_meta (key, value, updated_at)
              values ('schema_version', ${MIGRATION_VERSION}, now())
              on conflict (key)
              do update set value = excluded.value, updated_at = now()`;
    return;
  }

  const row = await sql<{ payload: unknown }[]>`
    select payload from bi_ops_snapshots where snapshot_key = ${SNAPSHOT_KEY}
  `;
  const payload = row[0]?.payload;
  const snapshotFromDb = isSnapshot(payload) ? payload : undefined;
  const snapshotFromFile = readFromFile(filePath);
  const source = snapshotFromDb ?? snapshotFromFile;
  if (source) {
    await persistNormalizedSnapshot(sql, source);
  }

  await sql`insert into bi_ops_meta (key, value, updated_at)
            values ('schema_version', ${MIGRATION_VERSION}, now())
            on conflict (key)
            do update set value = excluded.value, updated_at = now()`;
}

async function loadNormalizedSnapshot(sql: ReturnType<typeof postgres>): Promise<BiOpsStoreSnapshot> {
  const [
    usersRows,
    rolesRows,
    rulesRows,
    reportsRows,
    pagesRows,
    datasetsRows,
    workspacesRows,
    permissionsRows,
    favoritesRows,
    syncRunsRows,
    syncDeltaItemsRows,
  ] = await Promise.all([
    sql`select id, email, tenant_id as "tenantId", role_ids as "roleIds", custom_fields as "customFields" from bi_ops_users`,
    sql`select id, name, is_required_rule as "isRequiredRule" from bi_ops_roles`,
    sql`select id, name, table_name as "table", column_name as "column", values_json as values from bi_ops_rules`,
    sql`select id, workspace_id as "workspaceId", dataset_id as "datasetId", name, display_name as "displayName", embed_url as "embedUrl", page_ids as "pageIds", source_bi_id as "sourceBiId", source_updated_at as "sourceUpdatedAt", last_seen_at as "lastSeenAt", is_deleted as "isDeleted", content_hash as "contentHash" from bi_ops_reports`,
    sql`select id, report_id as "reportId", name, display_name as "displayName", source_bi_id as "sourceBiId", source_updated_at as "sourceUpdatedAt", last_seen_at as "lastSeenAt", is_deleted as "isDeleted", content_hash as "contentHash" from bi_ops_pages`,
    sql`select id, workspace_id as "workspaceId", name, source_bi_id as "sourceBiId", source_updated_at as "sourceUpdatedAt", last_seen_at as "lastSeenAt", is_deleted as "isDeleted", content_hash as "contentHash" from bi_ops_datasets`,
    sql`select id, name, display_name as "displayName", source_bi_id as "sourceBiId", source_updated_at as "sourceUpdatedAt", last_seen_at as "lastSeenAt", is_deleted as "isDeleted", content_hash as "contentHash" from bi_ops_workspaces`,
    sql`select user_id as "userId", report_id as "reportId", page_id as "pageId", rule_id as "ruleId" from bi_ops_permissions`,
    sql`select user_id as "userId", report_id as "reportId" from bi_ops_favorites`,
    sql`select id, mode, workspace_id as "workspaceId", dry_run as "dryRun", status, started_at as "startedAt", finished_at as "finishedAt", triggered_by as "triggeredBy", error, summary_counts as "summaryCounts" from bi_ops_sync_runs`,
    sql`select run_id as "runId", entity_type as "entityType", entity_id as "entityId", workspace_id as "workspaceId", change_type as "changeType", before_hash as "beforeHash", after_hash as "afterHash", metadata from bi_ops_sync_delta_items`,
  ]);

  return {
    users: usersRows as unknown as BiOpsStoreSnapshot["users"],
    roles: rolesRows as unknown as BiOpsStoreSnapshot["roles"],
    rules: rulesRows as unknown as BiOpsStoreSnapshot["rules"],
    reports: reportsRows as unknown as BiOpsStoreSnapshot["reports"],
    pages: pagesRows as unknown as BiOpsStoreSnapshot["pages"],
    datasets: datasetsRows as unknown as BiOpsStoreSnapshot["datasets"],
    workspaces: workspacesRows as unknown as BiOpsStoreSnapshot["workspaces"],
    permissions: permissionsRows as unknown as BiOpsStoreSnapshot["permissions"],
    favorites: favoritesRows as unknown as BiOpsStoreSnapshot["favorites"],
    syncRuns: syncRunsRows as unknown as BiOpsStoreSnapshot["syncRuns"],
    syncDeltaItems: syncDeltaItemsRows as unknown as BiOpsStoreSnapshot["syncDeltaItems"],
  };
}

async function persistNormalizedSnapshot(sql: ReturnType<typeof postgres>, snapshot: BiOpsStoreSnapshot): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`truncate table bi_ops_sync_delta_items, bi_ops_sync_runs, bi_ops_favorites, bi_ops_permissions, bi_ops_pages, bi_ops_reports, bi_ops_datasets, bi_ops_workspaces, bi_ops_rules, bi_ops_roles, bi_ops_users`;

    for (const user of snapshot.users) {
      await tx`insert into bi_ops_users (id, email, tenant_id, role_ids, custom_fields)
               values (${user.id}, ${user.email}, ${user.tenantId}, ${JSON.stringify(user.roleIds)}::jsonb, ${JSON.stringify(user.customFields)}::jsonb)`;
    }
    for (const role of snapshot.roles) {
      await tx`insert into bi_ops_roles (id, name, is_required_rule) values (${role.id}, ${role.name}, ${role.isRequiredRule})`;
    }
    for (const rule of snapshot.rules) {
      await tx`insert into bi_ops_rules (id, name, table_name, column_name, values_json)
               values (${rule.id}, ${rule.name}, ${rule.table}, ${rule.column}, ${JSON.stringify(rule.values)}::jsonb)`;
    }
    for (const workspace of snapshot.workspaces) {
      await tx`insert into bi_ops_workspaces (id, name, display_name, source_bi_id, source_updated_at, last_seen_at, is_deleted, content_hash)
               values (${workspace.id}, ${workspace.name}, ${workspace.displayName}, ${workspace.sourceBiId}, ${workspace.sourceUpdatedAt ?? null}, ${workspace.lastSeenAt ?? null}, ${workspace.isDeleted}, ${workspace.contentHash ?? null})`;
    }
    for (const dataset of snapshot.datasets) {
      await tx`insert into bi_ops_datasets (id, workspace_id, name, source_bi_id, source_updated_at, last_seen_at, is_deleted, content_hash)
               values (${dataset.id}, ${dataset.workspaceId}, ${dataset.name}, ${dataset.sourceBiId}, ${dataset.sourceUpdatedAt ?? null}, ${dataset.lastSeenAt ?? null}, ${dataset.isDeleted}, ${dataset.contentHash ?? null})`;
    }
    for (const report of snapshot.reports) {
      await tx`insert into bi_ops_reports (id, workspace_id, dataset_id, name, display_name, embed_url, page_ids, source_bi_id, source_updated_at, last_seen_at, is_deleted, content_hash)
               values (${report.id}, ${report.workspaceId}, ${report.datasetId}, ${report.name}, ${report.displayName}, ${report.embedUrl}, ${JSON.stringify(report.pageIds)}::jsonb, ${report.sourceBiId ?? null}, ${report.sourceUpdatedAt ?? null}, ${report.lastSeenAt ?? null}, ${report.isDeleted}, ${report.contentHash ?? null})`;
    }
    for (const page of snapshot.pages) {
      await tx`insert into bi_ops_pages (id, report_id, name, display_name, source_bi_id, source_updated_at, last_seen_at, is_deleted, content_hash)
               values (${page.id}, ${page.reportId}, ${page.name}, ${page.displayName}, ${page.sourceBiId ?? null}, ${page.sourceUpdatedAt ?? null}, ${page.lastSeenAt ?? null}, ${page.isDeleted}, ${page.contentHash ?? null})`;
    }
    for (const permission of snapshot.permissions) {
      await tx`insert into bi_ops_permissions (user_id, report_id, page_id, rule_id)
               values (${permission.userId}, ${permission.reportId}, ${permission.pageId ?? null}, ${permission.ruleId ?? null})`;
    }
    for (const favorite of snapshot.favorites) {
      await tx`insert into bi_ops_favorites (user_id, report_id) values (${favorite.userId}, ${favorite.reportId})`;
    }
    for (const run of snapshot.syncRuns) {
      await tx`insert into bi_ops_sync_runs (id, mode, workspace_id, dry_run, status, started_at, finished_at, triggered_by, error, summary_counts)
               values (${run.id}, ${run.mode}, ${run.workspaceId ?? null}, ${run.dryRun}, ${run.status}, ${run.startedAt}, ${run.finishedAt ?? null}, ${run.triggeredBy}, ${run.error ?? null}, ${JSON.stringify(run.summaryCounts)}::jsonb)`;
    }
    for (const item of snapshot.syncDeltaItems) {
      await tx`insert into bi_ops_sync_delta_items (run_id, entity_type, entity_id, workspace_id, change_type, before_hash, after_hash, metadata)
               values (${item.runId}, ${item.entityType}, ${item.entityId}, ${item.workspaceId ?? null}, ${item.changeType}, ${item.beforeHash ?? null}, ${item.afterHash ?? null}, ${item.metadata ? JSON.stringify(item.metadata) : null}::jsonb)`;
    }
  });
}

function hasMeaningfulData(snapshot: BiOpsStoreSnapshot): boolean {
  return (
    snapshot.users.length > 0 ||
    snapshot.roles.length > 0 ||
    snapshot.reports.length > 0 ||
    snapshot.pages.length > 0 ||
    snapshot.datasets.length > 0 ||
    snapshot.workspaces.length > 0 ||
    snapshot.permissions.length > 0 ||
    snapshot.favorites.length > 0 ||
    snapshot.syncRuns.length > 0 ||
    snapshot.syncDeltaItems.length > 0
  );
}

function isSnapshot(value: unknown): value is BiOpsStoreSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BiOpsStoreSnapshot>;
  return (
    Array.isArray(candidate.users) &&
    Array.isArray(candidate.roles) &&
    Array.isArray(candidate.rules) &&
    Array.isArray(candidate.reports) &&
    Array.isArray(candidate.pages) &&
    Array.isArray(candidate.datasets) &&
    Array.isArray(candidate.workspaces) &&
    Array.isArray(candidate.permissions) &&
    Array.isArray(candidate.favorites) &&
    Array.isArray(candidate.syncRuns) &&
    Array.isArray(candidate.syncDeltaItems)
  );
}
