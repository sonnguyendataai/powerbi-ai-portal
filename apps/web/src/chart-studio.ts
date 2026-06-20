import { PolicyEngine, emitAudit } from "@portal/agent-core";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";
import { loadEnv } from "./env";
import { generateChartSpec as generateChartSpecLLM, type SchemaInput } from "./llm-anthropic";
import { fetchDatasetSchema, fetchPowerBiToken } from "./powerbi-schema";

export interface ChartSpec {
  title: string;
  chartType: "bar" | "line" | "area" | "scatter" | "table";
  x: string;
  y: string;
  filters: Array<{ field: string; operator: "eq" | "in" | "between"; values: string[] }>;
  rationale?: string;
  groundedInSchema: boolean;
}

export interface ChartContext {
  reportName?: string;
  workspaceId?: string;
  datasetId?: string;
}

export async function generateChartSpec(
  user: SessionUser,
  prompt: string,
  context?: ChartContext,
): Promise<ChartSpec> {
  const policy = new PolicyEngine();
  const decision = policy.evaluate({
    subject: { userId: user.userId, tenantId: user.tenantId, roles: user.roles },
    action: "generate_chart",
    resource: buildResource(user.tenantId, "chart", "studio"),
  });
  if (!decision.allowed) throw new Error(decision.reason ?? "chart generation denied");

  const env = loadEnv(process.env);
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("AI chart generation is not configured. Please set ANTHROPIC_API_KEY.");
  }

  // Pull the live schema when a dataset is in scope, so field mapping is real.
  let schema: SchemaInput = { tables: [], measures: [] };
  if (context?.workspaceId && context.datasetId && env.POWERBI_TENANT_ID && env.POWERBI_CLIENT_ID && env.POWERBI_CLIENT_SECRET) {
    try {
      const token = await fetchPowerBiToken(env.POWERBI_TENANT_ID, env.POWERBI_CLIENT_ID, env.POWERBI_CLIENT_SECRET);
      schema = await fetchDatasetSchema(context.workspaceId, context.datasetId, token);
    } catch {
      // Non-fatal: fall back to schema-free generation.
    }
  }

  const spec = await generateChartSpecLLM({
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
    prompt,
    schema,
    ...(context?.reportName ? { reportName: context.reportName } : {}),
  });

  emitAudit({
    kind: "chart.generated",
    userId: user.userId,
    tenantId: user.tenantId,
    metadata: { chartType: spec.chartType, promptLength: prompt.length, grounded: schema.tables.length > 0 },
  });

  return { ...spec, groundedInSchema: schema.tables.length > 0 };
}
