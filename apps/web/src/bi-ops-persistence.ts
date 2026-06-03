import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import type { BiOpsStoreSnapshot } from "@portal/bi-operations";

const SNAPSHOT_KEY = "global";

export async function loadBiOpsSnapshot(
  opts: { filePath: string; databaseUrl?: string },
): Promise<BiOpsStoreSnapshot | undefined> {
  if (opts.databaseUrl) {
    const dbSnapshot = await loadFromDatabase(opts.databaseUrl);
    if (dbSnapshot) return dbSnapshot;
  }
  return readFromFile(opts.filePath);
}

export function persistBiOpsSnapshot(
  opts: { filePath: string; databaseUrl?: string },
  snapshot: BiOpsStoreSnapshot,
): void {
  writeToFile(opts.filePath, snapshot);
  if (opts.databaseUrl) {
    void writeToDatabase(opts.databaseUrl, snapshot);
  }
}

async function loadFromDatabase(databaseUrl: string): Promise<BiOpsStoreSnapshot | undefined> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql`
      create table if not exists bi_ops_snapshots (
        snapshot_key text primary key,
        payload jsonb not null,
        updated_at timestamptz not null default now()
      )
    `;
    const rows = await sql<{ payload: unknown }[]>`
      select payload from bi_ops_snapshots where snapshot_key = ${SNAPSHOT_KEY}
    `;
    if (rows.length === 0) return undefined;
    return rows[0]?.payload as BiOpsStoreSnapshot;
  } catch {
    return undefined;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function writeToDatabase(databaseUrl: string, snapshot: BiOpsStoreSnapshot): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const snapshotJson = JSON.stringify(snapshot);
    await sql`
      create table if not exists bi_ops_snapshots (
        snapshot_key text primary key,
        payload jsonb not null,
        updated_at timestamptz not null default now()
      )
    `;
    await sql`
      insert into bi_ops_snapshots (snapshot_key, payload, updated_at)
      values (${SNAPSHOT_KEY}, ${snapshotJson}::jsonb, now())
      on conflict (snapshot_key)
      do update set payload = excluded.payload, updated_at = now()
    `;
  } catch {
    // no-op: API operations should not fail if persistence backend is transiently unavailable
  } finally {
    await sql.end({ timeout: 1 });
  }
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
