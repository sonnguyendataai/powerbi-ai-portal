import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { loadEnv } from "@/env";
import { authenticateLocalUser, ensureAuthSchema } from "@/auth-db";
import { signSessionToken } from "@/app/api/_lib/session";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request): Promise<Response> {
  const env = loadEnv(process.env);
  if (!env.SESSION_SIGNING_SECRET) {
    return NextResponse.json({ error: "session_signing_secret_not_configured" }, { status: 500 });
  }
  await ensureAuthSchema();
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  const identity = await authenticateLocalUser(parsed.data);
  if (!identity) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = signSessionToken(
    {
      sub: identity.userId,
      tenantId: identity.tenantId,
      roles: identity.roles,
      provider: "local",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    env.SESSION_SIGNING_SECRET,
  );

  const res = NextResponse.json({
    ok: true,
    user: {
      id: identity.userId,
      username: identity.username,
      tenantId: identity.tenantId,
      roles: identity.roles,
    },
    loginId: randomUUID(),
  });
  res.cookies.set("portal_session", token, {
    httpOnly: true,
    secure: env.APP_ENV === "prod",
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  res.cookies.set("portal_tenant", identity.tenantId, {
    httpOnly: false,
    secure: env.APP_ENV === "prod",
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  return res;
}
