import postgres from "postgres";

interface WindowCounter {
  count: number;
  resetAtMs: number;
}

// Max entries kept in memory to prevent unbounded growth
const COUNTER_MAX_SIZE = 10_000;
const counters = new Map<string, WindowCounter>();

let _rateLimitPool: ReturnType<typeof postgres> | undefined;
function getRateLimitPool(databaseUrl: string): ReturnType<typeof postgres> {
  if (!_rateLimitPool) {
    _rateLimitPool = postgres(databaseUrl, { max: 3, idle_timeout: 30 });
  }
  return _rateLimitPool;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  databaseUrl?: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  if (databaseUrl) {
    return await checkRateLimitInDb(key, limit, windowMs, databaseUrl);
  }
  return checkRateLimitInMemory(key, limit, windowMs);
}

function checkRateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();

  // Evict expired entries when map grows too large
  if (counters.size >= COUNTER_MAX_SIZE) {
    for (const [k, v] of counters) {
      if (v.resetAtMs <= now) counters.delete(k);
      if (counters.size < COUNTER_MAX_SIZE * 0.8) break;
    }
  }

  const existing = counters.get(key);
  if (!existing || existing.resetAtMs <= now) {
    counters.set(key, { count: 1, resetAtMs: now + windowMs });
    return { allowed: true };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true };
}

async function checkRateLimitInDb(
  key: string,
  limit: number,
  windowMs: number,
  databaseUrl: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const sql = getRateLimitPool(databaseUrl);
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowKey = `${key}:${windowStart}`;

  try {
    await sql`create table if not exists api_rate_limits (
      key text primary key,
      count int not null,
      expires_at bigint not null
    )`;
    const rows = await sql<{ count: number; expires_at: number }[]>`
      insert into api_rate_limits (key, count, expires_at)
      values (${windowKey}, 1, ${windowStart + windowMs})
      on conflict (key)
      do update set count = api_rate_limits.count + 1
      returning count, expires_at
    `;
    const row = rows[0];
    if (!row) return { allowed: true };
    if (row.count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((row.expires_at - now) / 1000)),
      };
    }
    return { allowed: true };
  } catch {
    return checkRateLimitInMemory(key, limit, windowMs);
  }
}
