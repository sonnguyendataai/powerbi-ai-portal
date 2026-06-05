import { NextResponse } from "next/server";
import { z } from "zod";
import { loadEnv } from "@/env";
import { signSessionToken } from "@/app/api/_lib/session";

const schema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  roles: z.array(z.enum(["portal-admin", "analyst", "viewer"])).min(1),
  region: z.enum(["NA", "EMEA", "APAC"]).optional(),
  ttlSeconds: z.number().int().positive().max(86400).default(3600),
});

export async function POST(req: Request): Promise<Response> {
  const env = loadEnv(process.env);
  if (env.APP_ENV === "prod") {
    return NextResponse.json({ error: "disabled_in_production" }, { status: 403 });
  }
  if (!env.SESSION_SIGNING_SECRET) {
    return NextResponse.json({ error: "session_signing_secret_not_configured" }, { status: 500 });
  }
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const payload = {
    sub: parsed.data.userId,
    tenantId: parsed.data.tenantId,
    roles: parsed.data.roles,
    provider: "local" as const,
    ...(parsed.data.region ? { region: parsed.data.region } : {}),
    exp: Math.floor(Date.now() / 1000) + parsed.data.ttlSeconds,
  };
  const token = signSessionToken(payload, env.SESSION_SIGNING_SECRET);

  const response = NextResponse.json({ ok: true, tenantId: parsed.data.tenantId });
  response.cookies.set("portal_session", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: parsed.data.ttlSeconds,
  });
  response.cookies.set("portal_tenant", parsed.data.tenantId, {
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: parsed.data.ttlSeconds,
  });
  return response;
}
