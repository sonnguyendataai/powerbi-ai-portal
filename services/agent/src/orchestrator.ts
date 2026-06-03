import { PolicyEngine } from "@portal/agent-core";
import { FABRIC_CORE_TOOLS, POWERBI_MCP_READ_TOOLS } from "@portal/mcp-tools";

export interface OrchestratorInput {
  tenantId: string;
  userId: string;
  roles: Array<"portal-admin" | "analyst" | "viewer">;
  question: string;
}

export interface OrchestratorPlan {
  intent: "lookup" | "compare" | "trend" | "explain";
  toolSequence: string[];
  reasoningNotes: string[];
}

export function buildOrchestrationPlan(input: OrchestratorInput): OrchestratorPlan {
  const policy = new PolicyEngine();
  const decision = policy.evaluate({
    subject: { userId: input.userId, tenantId: input.tenantId, roles: input.roles },
    action: "read_data",
    resource: `tenant:${input.tenantId}:semantic-model:default`,
  });
  if (!decision.allowed) {
    throw new Error(decision.reason ?? "query denied");
  }

  const lower = input.question.toLowerCase();
  const intent: OrchestratorPlan["intent"] = lower.includes("trend")
    ? "trend"
    : lower.includes("compare")
      ? "compare"
      : lower.includes("why")
        ? "explain"
        : "lookup";

  return {
    intent,
    toolSequence: [POWERBI_MCP_READ_TOOLS[0], POWERBI_MCP_READ_TOOLS[2], FABRIC_CORE_TOOLS[0]],
    reasoningNotes: [
      "Plan uses read-only tools first to minimize risk.",
      "All tool calls remain tenant-scoped by policy engine.",
      "Evidence artifacts are returned to the client response.",
    ],
  };
}
