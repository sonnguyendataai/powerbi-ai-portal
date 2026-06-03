import type { PolicyDecision, PolicyInput } from "./types";

const ANALYST_ALLOWED = new Set(["read_data", "transform_data", "generate_chart", "mint_embed_token"]);
const VIEWER_ALLOWED = new Set(["read_data", "mint_embed_token"]);

export class PolicyEngine {
  evaluate(input: PolicyInput): PolicyDecision {
    const tenantPrefix = `tenant:${input.subject.tenantId}:`;
    if (!input.resource.startsWith(tenantPrefix)) {
      return { allowed: false, reason: "cross-tenant access is denied" };
    }

    if (input.subject.roles.includes("portal-admin")) {
      return { allowed: true };
    }

    if (input.subject.roles.includes("analyst") && ANALYST_ALLOWED.has(input.action)) {
      return { allowed: true };
    }

    if (input.subject.roles.includes("viewer") && VIEWER_ALLOWED.has(input.action)) {
      return { allowed: true };
    }

    return { allowed: false, reason: "role does not allow requested action" };
  }
}
