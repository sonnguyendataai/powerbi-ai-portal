import type { SessionUser } from "@/auth";
import { createHmac, timingSafeEqual } from "node:crypto";
import { loadEnv } from "@/env";

interface SessionTokenPayload {
  sub: string;
  tenantId: string;
  roles: SessionUser["roles"];
  region?: SessionUser["region"];
  exp?: number;
}

export function resolveSessionUser(req: Request): SessionUser {
  const env = loadEnv(process.env);
  const token = extractSessionToken(req);
  if (token && env.SESSION_SIGNING_SECRET) {
    const payload = verifySignedToken(token, env.SESSION_SIGNING_SECRET);
    if (payload) {
      return {
        userId: payload.sub,
        tenantId: payload.tenantId,
        roles: payload.roles.length > 0 ? payload.roles : ["viewer"],
        ...(payload.region ? { region: payload.region } : {}),
      };
    }
  }

  if (env.APP_ENV === "prod") {
    throw new Error("invalid_or_missing_session_token");
  }

  const tenantId = req.headers.get("x-tenant-id") ?? "tenant-default";
  const userId = req.headers.get("x-user-id") ?? "user@example.com";
  const roleHeader = req.headers.get("x-user-roles") ?? "analyst";
  const roles = roleHeader.split(",").map((x) => x.trim()).filter(Boolean) as SessionUser["roles"];
  return { userId, tenantId, roles: roles.length > 0 ? roles : ["analyst"] };
}

export function assertTenantAccess(user: SessionUser, tenantId: string): void {
  if (user.tenantId !== tenantId && !user.roles.includes("portal-admin")) {
    throw new Error("cross_tenant_forbidden");
  }
}

function extractSessionToken(req: Request): string | undefined {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  const cookie = req.headers.get("cookie") ?? "";
  const raw = cookie
    .split(";")
    .map((x) => x.trim())
    .find((item) => item.startsWith("portal_session="));
  if (!raw) return undefined;
  return decodeURIComponent(raw.slice("portal_session=".length));
}

function verifySignedToken(token: string, secret: string): SessionTokenPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const expected = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionTokenPayload;
    if (!payload.sub || !payload.tenantId || !Array.isArray(payload.roles)) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  };
}
