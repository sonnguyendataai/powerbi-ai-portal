import type { AgentSubject } from "@portal/agent-core";
import type { SessionUser } from "./auth";

export function toAgentSubject(user: SessionUser): AgentSubject {
  return {
    userId: user.userId,
    tenantId: user.tenantId,
    roles: user.roles,
    ...(user.region ? { region: user.region } : {}),
  };
}

export function assertTenantAccess(user: SessionUser, tenantId: string): void {
  if (user.tenantId !== tenantId && !user.roles.includes("portal-admin")) {
    throw new Error("tenant mismatch");
  }
}
