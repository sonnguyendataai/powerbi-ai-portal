import { PowerBiEmbedTokenService } from "@portal/powerbi-embedded";
import { createEmbedToken } from "./embed-api";
import { loadEnv } from "./env";
import { emitTelemetry } from "./telemetry";
import type { SessionUser } from "./auth";

export async function postEmbedToken(
  user: SessionUser,
  payload: {
    reportId: string;
    workspaceId: string;
    datasetId: string;
    rlsRoles: string[];
  },
): Promise<{ embedUrl: string; embedToken: string; expiresAt: string }> {
  const env = loadEnv(process.env);
  const service = new PowerBiEmbedTokenService({
    tenantId: env.POWERBI_TENANT_ID,
    clientId: env.POWERBI_CLIENT_ID,
    clientSecret: env.POWERBI_CLIENT_SECRET,
  });
  const started = Date.now();
  const result = await createEmbedToken(service, { user, ...payload });
  emitTelemetry({
    name: "embed.token_issued",
    tenantId: user.tenantId,
    userId: user.userId,
    durationMs: Date.now() - started,
    metadata: { reportId: payload.reportId },
  });
  return result;
}
