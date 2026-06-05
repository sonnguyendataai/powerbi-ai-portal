import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadEnv } from "@/env";
import { verifySignedToken, type SessionTokenPayload } from "@/app/api/_lib/session";

export async function getServerSessionPayload(): Promise<SessionTokenPayload | null> {
  const env = loadEnv(process.env);
  const cookieStore = await cookies();
  const token = cookieStore.get("portal_session")?.value;
  if (!token || !env.SESSION_SIGNING_SECRET) return null;
  return verifySignedToken(token, env.SESSION_SIGNING_SECRET);
}

export async function requireServerSession(input?: { tenantSlug?: string; adminOnly?: boolean }): Promise<SessionTokenPayload> {
  const payload = await getServerSessionPayload();
  if (!payload) {
    redirect("/login");
  }
  if (input?.tenantSlug && payload.tenantId !== input.tenantSlug && !payload.roles.includes("portal-admin")) {
    redirect("/login?error=tenant_mismatch");
  }
  if (input?.adminOnly && !payload.roles.includes("portal-admin")) {
    redirect(`/t/${payload.tenantId}/dashboard?error=admin_required`);
  }
  return payload;
}
