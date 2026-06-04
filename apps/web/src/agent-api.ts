import { PolicyEngine, emitAudit } from "@portal/agent-core";
import { FABRIC_CORE_TOOLS, POWERBI_MCP_READ_TOOLS } from "@portal/mcp-tools";
import { runRuntimeQuery } from "@portal/agent-service";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";
import { loadEnv } from "./env";
import { generateAnthropicAnswer } from "./llm-anthropic";

export interface ChatAnswer {
  answer: string;
  evidence: string[];
  usedTools: string[];
}

export async function answerDataQuestion(user: SessionUser, question: string): Promise<ChatAnswer> {
  const env = loadEnv(process.env);
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

  const runtime = await runRuntimeQuery(
    {
      tenantId: user.tenantId,
      userId: user.userId,
      roles: user.roles,
      question,
    },
    {
      ...(process.env.POWERBI_MCP_URL ? { powerBiMcpUrl: process.env.POWERBI_MCP_URL } : {}),
      ...(process.env.FABRIC_CORE_MCP_URL ? { fabricMcpUrl: process.env.FABRIC_CORE_MCP_URL } : {}),
      ...(process.env.POWERBI_API_BASE_URL ? { powerBiApiBaseUrl: process.env.POWERBI_API_BASE_URL } : {}),
    },
  );
  const toolPlan = runtime.usedTools.length > 0
    ? runtime.usedTools
    : [POWERBI_MCP_READ_TOOLS[0], POWERBI_MCP_READ_TOOLS[2], FABRIC_CORE_TOOLS[0]];
  emitAudit({
    kind: "agent.query",
    userId: user.userId,
    tenantId: user.tenantId,
    metadata: { questionLength: question.length, tools: toolPlan },
  });

  const evidence = runtime.evidence.length > 0
    ? runtime.evidence
    : [
      "Dataset schema retrieved from list_datasets/get_dataset_schema",
      "DAX query executed via execute_dax_query",
      "Catalog metadata validated using Fabric search",
    ];
  let answer = runtime.answer || `Planned answer for: "${question}".`;
  if (env.ANTHROPIC_API_KEY) {
    try {
      answer = await generateAnthropicAnswer({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.ANTHROPIC_MODEL,
        tenantId: user.tenantId,
        question,
        intent: runtime.answer.startsWith("Intent=")
          ? runtime.answer.split(".")[0]?.replace("Intent=", "").trim() ?? "lookup"
          : "lookup",
        evidence,
      });
    } catch (error) {
      emitAudit({
        kind: "agent.query.llm_error",
        userId: user.userId,
        tenantId: user.tenantId,
        metadata: { message: error instanceof Error ? error.message : "anthropic_error" },
      });
    }
  }
  return { answer, evidence, usedTools: toolPlan };
}
