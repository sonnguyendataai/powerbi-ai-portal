import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import { loadEnv } from "@/env";

let _authPool: ReturnType<typeof postgres> | undefined;
function getAuthPool(databaseUrl: string): ReturnType<typeof postgres> {
  if (!_authPool) {
    _authPool = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 30,
      types: {
        json: { to: 114, from: [114, 3802], serialize: JSON.stringify, parse: JSON.parse },
      },
    });
  }
  return _authPool;
}

export interface PortalIdentity {
  userId: string;
  username: string;
  tenantId: string;
  roles: Array<"portal-admin" | "analyst" | "viewer">;
  displayName?: string;
}

interface UserRow {
  id: string;
  username: string;
  tenant_id: string;
  display_name: string | null;
  is_active: boolean;
  password_hash: string;
}

const ROLE_ALLOWLIST = new Set(["portal-admin", "analyst", "viewer"]);

export async function ensureAuthSchema(): Promise<void> {
  const env = loadEnv(process.env);
  if (!env.DATABASE_URL) return;
  const sql = getAuthPool(env.DATABASE_URL);
  try {
    await sql`create table if not exists portal_users (
      id text primary key,
      username text not null unique,
      tenant_id text not null,
      display_name text,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    )`;
    await sql`create table if not exists portal_user_credentials (
      user_id text primary key,
      password_hash text not null,
      password_updated_at timestamptz not null default now(),
      failed_attempts int not null default 0,
      locked_until timestamptz
    )`;
    await sql`create table if not exists portal_user_roles (
      user_id text not null,
      tenant_id text not null,
      role text not null,
      primary key (user_id, tenant_id, role)
    )`;
    await sql`create table if not exists portal_auth_audit (
      id text primary key,
      user_id text,
      provider text not null,
      action text not null,
      success boolean not null,
      detail jsonb,
      created_at timestamptz not null default now()
    )`;

    if (env.LOCAL_AUTH_BOOTSTRAP_USERNAME && env.LOCAL_AUTH_BOOTSTRAP_PASSWORD) {
      await bootstrapLocalAdmin(sql, {
        username: env.LOCAL_AUTH_BOOTSTRAP_USERNAME,
        password: env.LOCAL_AUTH_BOOTSTRAP_PASSWORD,
        tenantId: env.LOCAL_AUTH_BOOTSTRAP_TENANT_ID ?? "tenant-default",
      });
    }
  } catch (err) {
    throw err;
  }
}

export async function authenticateLocalUser(input: {
  username: string;
  password: string;
}): Promise<PortalIdentity | null> {
  const env = loadEnv(process.env);
  if (!env.DATABASE_URL) return null;
  const sql = getAuthPool(env.DATABASE_URL);
  const rows = await sql<UserRow[]>`
    select u.id, u.username, u.tenant_id, u.display_name, u.is_active, c.password_hash
    from portal_users u
    join portal_user_credentials c on c.user_id = u.id
    where u.username = ${input.username}
    limit 1
  `;
  const user = rows[0];
  if (!user || !user.is_active) return null;
  if (!verifyPassword(input.password, user.password_hash)) return null;

  const roleRows = await sql<{ role: string }[]>`
    select role from portal_user_roles
    where user_id = ${user.id} and tenant_id = ${user.tenant_id}
  `;
  const roles = roleRows
    .map((row) => row.role)
    .filter((role): role is "portal-admin" | "analyst" | "viewer" => ROLE_ALLOWLIST.has(role));
  return {
    userId: user.id,
    username: user.username,
    tenantId: user.tenant_id,
    roles: roles.length > 0 ? roles : ["viewer"],
    ...(user.display_name ? { displayName: user.display_name } : {}),
  };
}

export async function upsertMicrosoftIdentity(input: {
  subject: string;
  username: string;
  tenantId: string;
  displayName?: string;
  roles: Array<"portal-admin" | "analyst" | "viewer">;
}): Promise<PortalIdentity | null> {
  const env = loadEnv(process.env);
  if (!env.DATABASE_URL) return null;
  const sql = getAuthPool(env.DATABASE_URL);
  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into portal_users (id, username, tenant_id, display_name, is_active)
        values (${input.subject}, ${input.username}, ${input.tenantId}, ${input.displayName ?? null}, true)
        on conflict (id)
        do update set username = excluded.username, tenant_id = excluded.tenant_id, display_name = excluded.display_name, is_active = true
      `;
      await tx`delete from portal_user_roles where user_id = ${input.subject} and tenant_id = ${input.tenantId}`;
      for (const role of input.roles) {
        await tx`insert into portal_user_roles (user_id, tenant_id, role) values (${input.subject}, ${input.tenantId}, ${role})`;
      }
    });
    return {
      userId: input.subject,
      username: input.username,
      tenantId: input.tenantId,
      roles: input.roles.length > 0 ? input.roles : ["viewer"],
      ...(input.displayName ? { displayName: input.displayName } : {}),
    };
  } catch (err) {
    throw err;
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function bootstrapLocalAdmin(
  sql: ReturnType<typeof postgres>,
  input: { username: string; password: string; tenantId: string },
): Promise<void> {
  const userId = `local:${input.username.toLowerCase()}`;
  const row = await sql<{ id: string }[]>`select id from portal_users where id = ${userId} limit 1`;
  if (row[0]) return;
  const passwordHash = hashPassword(input.password);
  await sql.begin(async (tx) => {
    await tx`
      insert into portal_users (id, username, tenant_id, display_name, is_active)
      values (${userId}, ${input.username}, ${input.tenantId}, ${input.username}, true)
    `;
    await tx`
      insert into portal_user_credentials (user_id, password_hash)
      values (${userId}, ${passwordHash})
    `;
    await tx`
      insert into portal_user_roles (user_id, tenant_id, role)
      values (${userId}, ${input.tenantId}, 'portal-admin')
    `;
  });
}
