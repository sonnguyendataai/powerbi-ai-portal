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

export class PowerBiEmbedApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly body: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "PowerBiEmbedApiError";
  }
}

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

    const reportPath = `/groups/${req.workspaceId}/reports/${req.reportId}`;
    const reportRes = await fetch(`${API_BASE}${reportPath}`, { headers });
    if (!reportRes.ok) {
      throw await buildPowerBiError("Cannot load report metadata", reportRes, reportPath);
    }
    const reportJson = await reportRes.json() as { embedUrl?: unknown };
    const embedUrl = typeof reportJson.embedUrl === "string" ? reportJson.embedUrl : "";
    if (!embedUrl) throw new Error("Report metadata missing embedUrl");

    const tokenPath = `/groups/${req.workspaceId}/reports/${req.reportId}/GenerateToken`;
    const tokenBody: Record<string, unknown> = {
      accessLevel: req.accessLevel,
    };
    // Only include identities when RLS roles are configured on the dataset.
    // Sending identities for a dataset without RLS causes Power BI to return 400 InvalidRequest.
    if (req.identities && req.identities.length > 0 && (req.identities[0]?.roles.length ?? 0) > 0) {
      tokenBody.identities = req.identities;
    }
    const tokenRes = await fetch(
      `${API_BASE}${tokenPath}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(tokenBody),
      },
    );
    if (!tokenRes.ok) {
      throw await buildPowerBiError("Cannot generate embed token", tokenRes, tokenPath);
    }
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

async function buildPowerBiError(prefix: string, res: Response, path: string): Promise<PowerBiEmbedApiError> {
  const body = await safeReadBody(res);
  const requestId = res.headers.get("requestid") ?? res.headers.get("x-ms-request-id") ?? undefined;
  const requestPart = requestId ? ` requestId=${requestId}` : "";
  const bodyPart = body ? ` body=${truncate(body, 600)}` : "";
  return new PowerBiEmbedApiError(`${prefix} (${res.status}) on ${path}${requestPart}${bodyPart}`, res.status, path, body, requestId);
}

async function safeReadBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
