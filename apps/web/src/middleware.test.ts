import { describe, expect, it } from "vitest";
import { signSessionToken } from "./app/api/_lib/session";

const SECRET = "test-secret-32-chars-padded-xxxxx";

// Mirror the Edge-compatible decode logic from middleware.ts
function extractTenantFromSession(token: string): string | null {
  try {
    const encodedPayload = token.split(".")[0];
    if (!encodedPayload) return null;
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as { tenantId?: unknown; exp?: number };
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return typeof payload.tenantId === "string" ? payload.tenantId : null;
  } catch {
    return null;
  }
}

describe("middleware tenant decode (Edge-compatible)", () => {
  it("extracts tenantId from a valid token", () => {
    const token = signSessionToken(
      { sub: "u1", tenantId: "tenant-abc", roles: ["viewer"], provider: "local" },
      SECRET,
    );
    expect(extractTenantFromSession(token)).toBe("tenant-abc");
  });

  it("returns null for a malformed token", () => {
    expect(extractTenantFromSession("not.a.token")).toBeNull();
    expect(extractTenantFromSession("")).toBeNull();
  });

  it("returns null for an expired token", () => {
    const token = signSessionToken(
      { sub: "u1", tenantId: "tenant-abc", roles: ["viewer"], provider: "local", exp: Math.floor(Date.now() / 1000) - 10 },
      SECRET,
    );
    expect(extractTenantFromSession(token)).toBeNull();
  });

  it("still extracts tenant from a tampered token (signature check is in API layer)", () => {
    const token = signSessionToken(
      { sub: "u1", tenantId: "tenant-abc", roles: ["viewer"], provider: "local" },
      SECRET,
    );
    // Middleware only decodes — tampered signature doesn't affect payload decode
    const tampered = token.slice(0, -4) + "xxxx";
    // tenantId is in the payload (first segment), tampering the signature doesn't change it
    expect(extractTenantFromSession(tampered)).toBe("tenant-abc");
  });
});
