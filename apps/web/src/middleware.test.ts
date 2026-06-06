import { describe, expect, it } from "vitest";
import { signSessionToken } from "./app/api/_lib/session";

const SECRET = "test-secret-32-chars-padded-xxxxx";

function makeRequest(pathname: string, cookies: Record<string, string> = {}): Request {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new Request(`http://localhost${pathname}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

// Inline the middleware's JWT extraction logic so we can unit-test it without
// Next.js internals (NextRequest is hard to construct in vitest).
function extractTenantFromSession(token: string, secret: string): string | null {
  try {
    const { createHmac, timingSafeEqual } = require("node:crypto") as typeof import("node:crypto");
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return null;
    const expected = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      tenantId?: unknown;
      exp?: number;
    };
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return typeof payload.tenantId === "string" ? payload.tenantId : null;
  } catch {
    return null;
  }
}

describe("middleware tenant validation", () => {
  it("extracts tenantId from a valid signed token", () => {
    const token = signSessionToken(
      { sub: "u1", tenantId: "tenant-abc", roles: ["viewer"], provider: "local" },
      SECRET,
    );
    expect(extractTenantFromSession(token, SECRET)).toBe("tenant-abc");
  });

  it("returns null for tampered token", () => {
    const token = signSessionToken(
      { sub: "u1", tenantId: "tenant-abc", roles: ["viewer"], provider: "local" },
      SECRET,
    );
    expect(extractTenantFromSession(token.slice(0, -4) + "xxxx", SECRET)).toBeNull();
  });

  it("returns null for expired token", () => {
    const token = signSessionToken(
      { sub: "u1", tenantId: "tenant-abc", roles: ["viewer"], provider: "local", exp: Math.floor(Date.now() / 1000) - 10 },
      SECRET,
    );
    expect(extractTenantFromSession(token, SECRET)).toBeNull();
  });

  it("returns null when verified with wrong secret", () => {
    const token = signSessionToken(
      { sub: "u1", tenantId: "tenant-abc", roles: ["viewer"], provider: "local" },
      SECRET,
    );
    expect(extractTenantFromSession(token, "wrong-secret")).toBeNull();
  });
});
