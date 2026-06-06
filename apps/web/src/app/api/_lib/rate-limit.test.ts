import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit (in-memory)", () => {
  it("allows first request", async () => {
    const key = `test:allow:${Date.now()}`;
    const result = await checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("blocks after limit", async () => {
    const key = `test:block:${Date.now()}`;
    const first = await checkRateLimit(key, 1, 60_000);
    const second = await checkRateLimit(key, 1, 60_000);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });

  it("includes retryAfterSeconds when blocked", async () => {
    const key = `test:retry:${Date.now()}`;
    await checkRateLimit(key, 1, 60_000);
    const blocked = await checkRateLimit(key, 1, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("allows again after window expires", async () => {
    const key = `test:window:${Date.now()}`;
    await checkRateLimit(key, 1, 1); // 1ms window
    await new Promise((r) => setTimeout(r, 5));
    const result = await checkRateLimit(key, 1, 1);
    expect(result.allowed).toBe(true);
  });

  it("counts multiple requests within limit", async () => {
    const key = `test:count:${Date.now()}`;
    const results = await Promise.all([
      checkRateLimit(key, 3, 60_000),
      checkRateLimit(key, 3, 60_000),
      checkRateLimit(key, 3, 60_000),
    ]);
    expect(results.every((r) => r.allowed)).toBe(true);
    const blocked = await checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
  });
});
