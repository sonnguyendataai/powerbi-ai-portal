import { PolicyEngine, emitAudit } from "@portal/agent-core";
import { PowerBiEmbedTokenService, type EffectiveIdentity } from "@portal/powerbi-embedded";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";

export interface EmbedRequestInput {
  user: SessionUser;
  reportId: string;
  workspaceId: string;
  datasetId: string;
  rlsRoles: string[];
}

export async function createEmbedToken(
  svc: PowerBiEmbedTokenService,
  input: EmbedRequestInput,
): Promise<{ embedUrl: string; embedToken: string; expiresAt: string }> {
  const policy = new PolicyEngine();
  const resource = buildResource(input.user.tenantId, "report", input.reportId);
  const decision = policy.evaluate({
    subject: {
      userId: input.user.userId,
      tenantId: input.user.tenantId,
      roles: input.user.roles,
      ...(input.user.region ? { region: input.user.region } : {}),
    },
    action: "mint_embed_token",
    resource,
  });
  if (!decision.allowed) {
    emitAudit({
      kind: "embed.denied",
      userId: input.user.userId,
      tenantId: input.user.tenantId,
      metadata: { reportId: input.reportId, reason: decision.reason ?? "policy-denied" },
    });
    throw new Error(decision.reason ?? "embed denied");
  }

  // Only attach effective identity (RLS) when the report has RLS roles configured.
  // Sending identities for datasets without RLS causes Power BI to return 400.
  const identities: EffectiveIdentity[] | undefined =
    input.rlsRoles.length > 0
      ? [
          {
            username: input.user.userId,
            datasets: [input.datasetId],
            roles: input.rlsRoles,
            customData: JSON.stringify({
              tenantId: input.user.tenantId,
              roleSource: "portal-rbac",
              region: input.user.region ?? null,
            }),
          },
        ]
      : undefined;
  const bundle = await svc.createEmbedBundle({
    reportId: input.reportId,
    workspaceId: input.workspaceId,
    datasetId: input.datasetId,
    identities,
    accessLevel: "View",
  });
  emitAudit({
    kind: "embed.issued",
    userId: input.user.userId,
    tenantId: input.user.tenantId,
    metadata: { reportId: input.reportId, workspaceId: input.workspaceId, datasetId: input.datasetId },
  });
  return {
    embedUrl: bundle.embedUrl,
    embedToken: bundle.embedToken,
    expiresAt: bundle.expiresAt,
  };
}
