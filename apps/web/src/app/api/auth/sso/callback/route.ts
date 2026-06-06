import { NextResponse } from "next/server";
import { loadEnv } from "@/env";

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}
import { discoverMicrosoftOidc, exchangeCodeForProfile } from "@/auth-microsoft";
import { signSessionToken } from "@/app/api/_lib/session";
import { ensureAuthSchema, upsertMicrosoftIdentity } from "@/auth-db";

export async function GET(req: Request): Promise<Response> {
  const env = loadEnv(process.env);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = req.headers.get("cookie")?.split(";").map((v) => v.trim()).find((x) => x.startsWith("portal_oidc_state="));
  const verifierCookie = req.headers.get("cookie")?.split(";").map((v) => v.trim()).find((x) => x.startsWith("portal_oidc_pkce="));
  const expectedState = safeDecodeURIComponent(stateCookie?.slice("portal_oidc_state=".length) ?? "");
  const verifier = safeDecodeURIComponent(verifierCookie?.slice("portal_oidc_pkce=".length) ?? "");
  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return NextResponse.redirect(new URL("/login?error=sso_state_invalid", req.url));
  }
  if (!env.SESSION_SIGNING_SECRET || !env.AZURE_AD_CLIENT_ID || !env.AZURE_AD_CLIENT_SECRET || !env.AZURE_AD_REDIRECT_URI) {
    return NextResponse.redirect(new URL("/login?error=sso_not_configured", req.url));
  }

  try {
    await ensureAuthSchema();
    const discovery = await discoverMicrosoftOidc();
    const profile = await exchangeCodeForProfile({
      tokenEndpoint: discovery.token_endpoint,
      clientId: env.AZURE_AD_CLIENT_ID,
      clientSecret: env.AZURE_AD_CLIENT_SECRET,
      redirectUri: env.AZURE_AD_REDIRECT_URI,
      code,
      codeVerifier: verifier,
    });
    const identity = await upsertMicrosoftIdentity({
      subject: profile.subject,
      username: profile.username,
      tenantId: profile.tenantId,
      ...(profile.displayName ? { displayName: profile.displayName } : {}),
      roles: ["viewer"],
    });
    if (!identity) {
      return NextResponse.redirect(new URL("/login?error=sso_user_upsert_failed", req.url));
    }
    const token = signSessionToken(
      {
        sub: identity.userId,
        tenantId: identity.tenantId,
        roles: identity.roles,
        provider: "microsoft-ad",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      env.SESSION_SIGNING_SECRET,
    );
    const success = NextResponse.redirect(new URL(`/t/${identity.tenantId}/dashboard`, req.url));
    success.cookies.set("portal_session", token, {
      httpOnly: true,
      secure: env.APP_ENV === "prod",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
    success.cookies.set("portal_tenant", identity.tenantId, {
      httpOnly: false,
      secure: env.APP_ENV === "prod",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
    success.cookies.set("portal_oidc_state", "", { httpOnly: true, path: "/", maxAge: 0 });
    success.cookies.set("portal_oidc_pkce", "", { httpOnly: true, path: "/", maxAge: 0 });
    return success;
  } catch {
    return NextResponse.redirect(new URL("/login?error=sso_failed", req.url));
  }
}
