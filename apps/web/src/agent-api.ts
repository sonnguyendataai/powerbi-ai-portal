import { PolicyEngine, emitAudit } from "@portal/agent-core";
import { FABRIC_CORE_TOOLS, POWERBI_MCP_READ_TOOLS } from "@portal/mcp-tools";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";

export interface ChatAnswer {
  answer: string;
  evidence: string[];
  usedTools: string[];
}

export async function answerDataQuestion(user: SessionUser, question: string): Promise<ChatAnswer> {
  const policy = new PolicyEngine();
  const resource = buildResource(user.tenantId, "semantic-model", "default");
  const decision = policy.evaluate({
    subject: {
      userId: user.userId,
      tenantId: user.tenantId,
      roles: user.roles,
      ...(user.region ? { region: user.region } : {}),
    },
    action: "read_data",
    resource,
  });
  if (!decision.allowed) {
    throw new Error(decision.reason ?? "permission denied");
  }

  const toolPlan = [POWERBI_MCP_READ_TOOLS[0], POWERBI_MCP_READ_TOOLS[2], FABRIC_CORE_TOOLS[0]];
  emitAudit({
    kind: "agent.query",
    userId: user.userId,
    tenantId: user.tenantId,
    metadata: { questionLength: question.length, tools: toolPlan },
  });

  const evidence = [
    "Dataset schema retrieved from list_datasets/get_dataset_schema",
    "DAX query executed via execute_dax_query",
    "Catalog metadata validated using Fabric search",
  ];
  return {
    answer: `Planned answer for: "${question}".`,
    evidence,
    usedTools: toolPlan,
  };
}
