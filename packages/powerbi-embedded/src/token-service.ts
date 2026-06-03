import { embedRequestSchema, type EmbedBundle, type EmbedRequest } from "./types";

interface PowerBiConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

interface AccessTokenState {
  token: string;
  expiresAtMs: number;
}

const API_BASE = "https://api.powerbi.com/v1.0/myorg";

export class PowerBiEmbedTokenService {
  private readonly cfg: PowerBiConfig;
  private cache: AccessTokenState | null = null;

  constructor(cfg: PowerBiConfig) {
    this.cfg = cfg;
  }

  async createEmbedBundle(input: EmbedRequest): Promise<EmbedBundle> {
    const req = embedRequestSchema.parse(input);
    const accessToken = await this.fetchAccessToken();
    const headers = this.headers(accessToken);

    const reportRes = await fetch(
      `${API_BASE}/groups/${req.workspaceId}/reports/${req.reportId}`,
      { headers },
    );
    if (!reportRes.ok) throw new Error(`Cannot load report metadata (${reportRes.status})`);
    const reportJson = await reportRes.json() as { embedUrl?: unknown };
    const embedUrl = typeof reportJson.embedUrl === "string" ? reportJson.embedUrl : "";
    if (!embedUrl) throw new Error("Report metadata missing embedUrl");

    const tokenRes = await fetch(
      `${API_BASE}/groups/${req.workspaceId}/reports/${req.reportId}/GenerateToken`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          accessLevel: req.accessLevel,
          identities: req.identities,
          datasetId: req.datasetId,
        }),
      },
    );
    if (!tokenRes.ok) throw new Error(`Cannot generate embed token (${tokenRes.status})`);
    const tokenJson = await tokenRes.json() as { token?: unknown; expiration?: unknown };
    const embedToken = typeof tokenJson.token === "string" ? tokenJson.token : "";
    const expiresAt = typeof tokenJson.expiration === "string" ? tokenJson.expiration : "";
    if (!embedToken || !expiresAt) throw new Error("Invalid embed token response");

    return {
      reportId: req.reportId,
      workspaceId: req.workspaceId,
      datasetId: req.datasetId,
      embedUrl,
      embedToken,
      expiresAt,
    };
  }

  private async fetchAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAtMs - now > 60_000) return this.cache.token;

    const form = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      scope: "https://analysis.windows.net/powerbi/api/.default",
    });
    const res = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(this.cfg.tenantId)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      },
    );
    if (!res.ok) throw new Error(`OAuth token failed (${res.status})`);
    const json = await res.json() as { access_token?: unknown; expires_in?: unknown };
    const token = typeof json.access_token === "string" ? json.access_token : "";
    const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 0;
    if (!token || expiresIn <= 0) throw new Error("OAuth response missing token");
    this.cache = { token, expiresAtMs: Date.now() + expiresIn * 1000 };
    return token;
  }

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }
}
