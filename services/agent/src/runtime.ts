import { z } from "zod";
import { buildOrchestrationPlan, type OrchestratorInput } from "./orchestrator";

const mcpResponseSchema = z.object({
  content: z.string().optional(),
  data: z.unknown().optional(),
});

export interface RuntimeConfig {
  powerBiMcpUrl?: string;
  fabricMcpUrl?: string;
  powerBiApiBaseUrl?: string;
}

export interface RuntimeAnswer {
  answer: string;
  evidence: string[];
  usedTools: string[];
}

export async function runRuntimeQuery(
  input: OrchestratorInput,
  config: RuntimeConfig,
): Promise<RuntimeAnswer> {
  const plan = buildOrchestrationPlan(input);
  const evidence: string[] = [];

  for (const tool of plan.toolSequence) {
    const result = await executeTool(tool, input.question, config);
    evidence.push(`${tool}: ${result}`);
  }

  return {
    answer: `Intent=${plan.intent}. Runtime executed ${plan.toolSequence.length} tool steps.`,
    evidence,
    usedTools: [...plan.toolSequence],
  };
}

async function executeTool(tool: string, question: string, config: RuntimeConfig): Promise<string> {
  const target = tool.includes("search") ? config.fabricMcpUrl : config.powerBiMcpUrl;
  if (!target) {
    return "mocked (endpoint not configured)";
  }

  const res = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool,
      input: { question },
    }),
  });

  if (!res.ok) {
    return `failed (${res.status})`;
  }
  const json = await res.json();
  const parsed = mcpResponseSchema.safeParse(json);
  if (!parsed.success) {
    return "ok (unstructured result)";
  }
  if (parsed.data.content) return parsed.data.content.slice(0, 200);
  if (parsed.data.data) return JSON.stringify(parsed.data.data).slice(0, 200);
  return "ok";
}
