import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { loadEnv } from "@/env";
import { buildAuthorizationUrl, createPkcePair, discoverMicrosoftOidc } from "@/auth-microsoft";

export async function GET(req: Request): Promise<Response> {
  const env = loadEnv(process.env);
  if (!env.AZURE_AD_CLIENT_ID || !env.AZURE_AD_REDIRECT_URI) {
    return NextResponse.json({ error: "azure_ad_not_configured" }, { status: 400 });
  }

  const discovery = await discoverMicrosoftOidc();
  const { verifier, challenge } = createPkcePair();
  const state = randomBytes(24).toString("base64url");
  const url = buildAuthorizationUrl({
    authorizationEndpoint: discovery.authorization_endpoint,
    clientId: env.AZURE_AD_CLIENT_ID,
    redirectUri: env.AZURE_AD_REDIRECT_URI,
    state,
    challenge,
  });
  const response = NextResponse.redirect(url);
  response.cookies.set("portal_oidc_state", state, {
    httpOnly: true,
    secure: env.APP_ENV === "prod",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  response.cookies.set("portal_oidc_pkce", verifier, {
    httpOnly: true,
    secure: env.APP_ENV === "prod",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
