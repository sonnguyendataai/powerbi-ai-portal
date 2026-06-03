import { z } from "zod";

export const appRoleSchema = z.enum(["portal-admin", "analyst", "viewer"]);
export type AppRole = z.infer<typeof appRoleSchema>;

export const agentActionSchema = z.enum([
  "read_data",
  "transform_data",
  "generate_chart",
  "mint_embed_token",
  "admin",
]);
export type AgentAction = z.infer<typeof agentActionSchema>;

export interface AgentSubject {
  userId: string;
  tenantId: string;
  roles: AppRole[];
  region?: "NA" | "EMEA" | "APAC";
}

export interface PolicyInput {
  subject: AgentSubject;
  action: AgentAction;
  resource: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

export interface AuditEvent {
  kind: string;
  tenantId: string;
  userId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
