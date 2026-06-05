import { createHash, randomBytes } from "node:crypto";
import { loadEnv } from "@/env";

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  issuer: string;
}

export interface MicrosoftProfile {
  subject: string;
  username: string;
  displayName?: string;
  tenantId: string;
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function discoverMicrosoftOidc(): Promise<OidcDiscovery> {
  const env = loadEnv(process.env);
  if (!env.AZURE_AD_TENANT_ID) throw new Error("azure_ad_tenant_not_configured");
  const wellKnownUrl = `https://login.microsoftonline.com/${encodeURIComponent(env.AZURE_AD_TENANT_ID)}/v2.0/.well-known/openid-configuration`;
  const res = await fetch(wellKnownUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`oidc_discovery_failed_${res.status}`);
  const json = (await res.json()) as Partial<OidcDiscovery>;
  if (!json.authorization_endpoint || !json.token_endpoint || !json.issuer) {
    throw new Error("oidc_discovery_invalid_payload");
  }
  return {
    authorization_endpoint: json.authorization_endpoint,
    token_endpoint: json.token_endpoint,
    issuer: json.issuer,
  };
}

export function buildAuthorizationUrl(input: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state: string;
  challenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    response_type: "code",
    redirect_uri: input.redirectUri,
    response_mode: "query",
    scope: input.scope ?? "openid profile email",
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  });
  return `${input.authorizationEndpoint}?${params.toString()}`;
}

export async function exchangeCodeForProfile(input: {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<MicrosoftProfile> {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
  const tokenRes = await fetch(input.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!tokenRes.ok) throw new Error(`oidc_token_exchange_failed_${tokenRes.status}`);
  const tokenJson = (await tokenRes.json()) as { id_token?: string };
  if (!tokenJson.id_token) throw new Error("oidc_missing_id_token");
  const payload = decodeJwtPayload(tokenJson.id_token);
  const subject = typeof payload.sub === "string" ? payload.sub : "";
  const username = typeof payload.preferred_username === "string"
    ? payload.preferred_username
    : typeof payload.email === "string"
      ? payload.email
      : "";
  const tenantId = typeof payload.tid === "string" ? payload.tid : "";
  if (!subject || !username || !tenantId) throw new Error("oidc_invalid_identity_claims");
  return {
    subject,
    username,
    tenantId,
    ...(typeof payload.name === "string" ? { displayName: payload.name } : {}),
  };
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length < 2) throw new Error("invalid_jwt");
  const body = parts[1];
  if (!body) throw new Error("invalid_jwt_payload");
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
}
