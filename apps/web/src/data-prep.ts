import { PolicyEngine, emitAudit } from "@portal/agent-core";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";
import { loadEnv } from "./env";
import { generateDataPrepPlan as generateDataPrepPlanLLM, type GeneratedTransform, type SchemaInput } from "./llm-anthropic";
import { fetchDatasetSchema, fetchPowerBiToken } from "./powerbi-schema";

export type TransformInstruction = GeneratedTransform;

export interface DataPrepPlan {
  datasetId: string;
  transforms: TransformInstruction[];
  summary: string;
  groundedInSchema: boolean;
}

export interface DataPrepContext {
  workspaceId?: string;
}

export async function buildDataPrepPlan(
  user: SessionUser,
  datasetId: string,
  intent: string,
  context?: DataPrepContext,
): Promise<DataPrepPlan> {
  const policy = new PolicyEngine();
  const decision = policy.evaluate({
    subject: { userId: user.userId, tenantId: user.tenantId, roles: user.roles },
    action: "transform_data",
    resource: buildResource(user.tenantId, "dataset", datasetId),
  });
  if (!decision.allowed) throw new Error(decision.reason ?? "transform denied");

  const env = loadEnv(process.env);
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("AI data-prep planning is not configured. Please set ANTHROPIC_API_KEY.");
  }

  // Pull the live schema when we can resolve the workspace, so the plan
  // references real columns rather than guessed ones.
  let schema: SchemaInput = { tables: [], measures: [] };
  if (context?.workspaceId && env.POWERBI_TENANT_ID && env.POWERBI_CLIENT_ID && env.POWERBI_CLIENT_SECRET) {
    try {
      const token = await fetchPowerBiToken(env.POWERBI_TENANT_ID, env.POWERBI_CLIENT_ID, env.POWERBI_CLIENT_SECRET);
      schema = await fetchDatasetSchema(context.workspaceId, datasetId, token);
    } catch {
      // Non-fatal: fall back to schema-free planning.
    }
  }

  const plan = await generateDataPrepPlanLLM({
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
    datasetId,
    intent,
    schema,
  });

  emitAudit({
    kind: "dataprep.plan_created",
    tenantId: user.tenantId,
    userId: user.userId,
    metadata: { datasetId, transformCount: plan.transforms.length, grounded: schema.tables.length > 0 },
  });

  return {
    datasetId,
    transforms: plan.transforms,
    summary: plan.summary,
    groundedInSchema: schema.tables.length > 0,
  };
}
