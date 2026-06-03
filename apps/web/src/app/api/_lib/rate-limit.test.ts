import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("blocks after limit", () => {
    const key = `test:${Date.now()}`;
    const first = checkRateLimit(key, 1, 60_000);
    const second = checkRateLimit(key, 1, 60_000);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });
});
