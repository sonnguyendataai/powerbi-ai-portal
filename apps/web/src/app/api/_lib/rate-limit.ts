interface WindowCounter {
  count: number;
  resetAtMs: number;
}

const counters = new Map<string, WindowCounter>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
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
