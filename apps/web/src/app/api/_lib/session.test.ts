import { describe, expect, it } from "vitest";
import { signSessionToken, verifySignedToken } from "./session";

const SECRET = "test-secret-32-chars-padded-xxxxx";

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const payload = {
      sub: "user-1",
      tenantId: "tenant-a",
      roles: ["viewer"] as ["viewer"],
      provider: "local" as const,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = signSessionToken(payload, SECRET);
    const result = verifySignedToken(token, SECRET);
    expect(result?.sub).toBe("user-1");
    expect(result?.tenantId).toBe("tenant-a");
  });

  it("rejects a tampered token", () => {
    const payload = {
      sub: "user-1",
      tenantId: "tenant-a",
      roles: ["viewer"] as ["viewer"],
      provider: "local" as const,
    };
    const token = signSessionToken(payload, SECRET);
    const tampered = token.slice(0, -3) + "xxx";
    expect(verifySignedToken(tampered, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const payload = {
      sub: "user-1",
      tenantId: "tenant-a",
      roles: ["viewer"] as ["viewer"],
      provider: "local" as const,
      exp: Math.floor(Date.now() / 1000) - 1,
    };
    const token = signSessionToken(payload, SECRET);
    expect(verifySignedToken(token, SECRET)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const payload = {
      sub: "user-1",
      tenantId: "tenant-a",
      roles: ["viewer"] as ["viewer"],
      provider: "local" as const,
    };
    const token = signSessionToken(payload, SECRET);
    expect(verifySignedToken(token, "wrong-secret")).toBeNull();
  });
});
