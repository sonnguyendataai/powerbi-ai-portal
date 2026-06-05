import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("blocks after limit", async () => {
    const key = `test:${Date.now()}`;
    const first = await checkRateLimit(key, 1, 60_000);
    const second = await checkRateLimit(key, 1, 60_000);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });
});
