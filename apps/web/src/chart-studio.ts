import { PolicyEngine, emitAudit } from "@portal/agent-core";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";
import { loadEnv } from "./env";
import { generateChartSpec as generateChartSpecLLM, type SchemaInput } from "./llm-anthropic";
import { fetchDatasetSchema, fetchFabricToken, fetchPowerBiToken } from "./powerbi-schema";
import { createFabricReport } from "./pbir-builder";

export interface ChartSpec {
  title: string;
  chartType: "bar" | "line" | "area" | "scatter" | "table";
  x: string;
  y: string;
  filters: Array<{ field: string; operator: "eq" | "in" | "between"; values: string[] }>;
  rationale?: string;
  groundedInSchema: boolean;
  // Populated only when create=true and a report was created in Power BI.
  createdReport?: { reportId: string; workspaceId: string; webUrl: string };
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
  create = false,
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
  const havePbiCreds = !!(env.POWERBI_TENANT_ID && env.POWERBI_CLIENT_ID && env.POWERBI_CLIENT_SECRET);
  if (context?.workspaceId && context.datasetId && havePbiCreds) {
    try {
      const token = await fetchPowerBiToken(env.POWERBI_TENANT_ID!, env.POWERBI_CLIENT_ID!, env.POWERBI_CLIENT_SECRET!);
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

  const groundedInSchema = schema.tables.length > 0;
  let createdReport: ChartSpec["createdReport"];

  if (create) {
    // Creating a real report needs a dataset to bind to and a Fabric-backed
    // workspace. Fail loudly with actionable messages rather than silently
    // returning just the spec.
    if (!context?.workspaceId || !context.datasetId) {
      throw new Error("Creating a report requires a dataset scope. Select a report/dataset first.");
    }
    if (!havePbiCreds) {
      throw new Error("Creating a report requires Power BI service-principal credentials to be configured.");
    }
    if (!spec.xBinding && !spec.yBinding) {
      throw new Error("Could not map the requested fields to the dataset schema, so no report was created. Try a more specific prompt or a dataset with a clearer schema.");
    }
    const fabricToken = await fetchFabricToken(env.POWERBI_TENANT_ID!, env.POWERBI_CLIENT_ID!, env.POWERBI_CLIENT_SECRET!);
    const result = await createFabricReport({
      fabricToken,
      workspaceId: context.workspaceId,
      semanticModelId: context.datasetId,
      displayName: spec.title || "AI Generated Report",
      spec,
    });
    createdReport = {
      reportId: result.reportId,
      workspaceId: context.workspaceId,
      webUrl: `https://app.powerbi.com/groups/${context.workspaceId}/reports/${result.reportId}`,
    };
  }

  emitAudit({
    kind: create ? "chart.report_created" : "chart.generated",
    userId: user.userId,
    tenantId: user.tenantId,
    metadata: {
      chartType: spec.chartType,
      promptLength: prompt.length,
      grounded: groundedInSchema,
      ...(createdReport ? { reportId: createdReport.reportId } : {}),
    },
  });

  return {
    ...spec,
    groundedInSchema,
    ...(createdReport ? { createdReport } : {}),
  };
}
