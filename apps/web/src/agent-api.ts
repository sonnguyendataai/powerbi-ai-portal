import { PolicyEngine, emitAudit } from "@portal/agent-core";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";
import { loadEnv } from "./env";
import { generateAnthropicAnswer } from "./llm-anthropic";
import { getBiOperationsService } from "./bi-ops";

export interface ChatAnswer {
  answer: string;
  evidence: string[];
  usedTools: string[];
}

export interface ReportContext {
  reportId: string;
  reportName: string;
  workspaceId: string;
  datasetId: string;
}

async function fetchPowerBiToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://analysis.windows.net/powerbi/api/.default",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form },
  );
  if (!res.ok) throw new Error(`Power BI OAuth failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Power BI OAuth response missing access_token");
  return json.access_token;
}

interface PbiTable { name: string; columns: Array<{ name: string; dataType: string }> }
interface PbiMeasure { name: string; expression: string }

async function fetchDatasetSchema(
  workspaceId: string,
  datasetId: string,
  token: string,
): Promise<{ tables: PbiTable[]; measures: PbiMeasure[] }> {
  const base = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}`;
  const [tablesRes, measuresRes] = await Promise.all([
    fetch(`${base}/tables`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${base}/measures`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  const tables: PbiTable[] = tablesRes.ok
    ? ((await tablesRes.json()) as { value: PbiTable[] }).value ?? []
    : [];
  const measures: PbiMeasure[] = measuresRes.ok
    ? ((await measuresRes.json()) as { value: PbiMeasure[] }).value ?? []
    : [];
  return { tables, measures };
}

interface PbiDataset { id: string; name: string }
interface PbiReport { id: string; name: string; datasetId: string }

async function fetchTenantContext(
  tenantId: string, clientId: string, clientSecret: string,
): Promise<{ datasets: PbiDataset[]; reports: PbiReport[] }> {
  const token = await fetchPowerBiToken(tenantId, clientId, clientSecret);
  const [dsRes, rpRes] = await Promise.all([
    fetch("https://api.powerbi.com/v1.0/myorg/datasets", { headers: { Authorization: `Bearer ${token}` } }),
    fetch("https://api.powerbi.com/v1.0/myorg/reports", { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  const datasets: PbiDataset[] = dsRes.ok ? ((await dsRes.json()) as { value: PbiDataset[] }).value ?? [] : [];
  const reports: PbiReport[] = rpRes.ok ? ((await rpRes.json()) as { value: PbiReport[] }).value ?? [] : [];
  return { datasets, reports };
}

export async function answerDataQuestion(
  user: SessionUser,
  question: string,
  reportContext?: ReportContext,
): Promise<ChatAnswer> {
  const env = loadEnv(process.env);

  const policy = new PolicyEngine();
  const resource = buildResource(user.tenantId, "semantic-model", "default");
  const decision = policy.evaluate({
    subject: { userId: user.userId, tenantId: user.tenantId, roles: user.roles, ...(user.region ? { region: user.region } : {}) },
    action: "read_data",
    resource,
  });
  if (!decision.allowed) throw new Error(decision.reason ?? "permission denied");

  const usedTools: string[] = [];
  const evidence: string[] = [];

  if (reportContext) {
    // Fast path: caller passed explicit report context — no enumeration needed
    usedTools.push("use_report_context");
    evidence.push(`Report: "${reportContext.reportName}" (ID: ${reportContext.reportId})`);
    evidence.push(`Workspace ID: ${reportContext.workspaceId}`);
    evidence.push(`Dataset ID: ${reportContext.datasetId}`);

    // Enrich with live dataset schema if credentials are available
    if (env.POWERBI_TENANT_ID && env.POWERBI_CLIENT_ID && env.POWERBI_CLIENT_SECRET) {
      try {
        const token = await fetchPowerBiToken(
          env.POWERBI_TENANT_ID, env.POWERBI_CLIENT_ID, env.POWERBI_CLIENT_SECRET,
        );
        usedTools.push("get_dataset_schema");
        const schema = await fetchDatasetSchema(reportContext.workspaceId, reportContext.datasetId, token);
        if (schema.tables.length > 0) {
          const tablesSummary = schema.tables
            .slice(0, 8)
            .map((t) => `${t.name}(${t.columns.slice(0, 6).map((c) => `${c.name}:${c.dataType}`).join(", ")})`)
            .join("; ");
          evidence.push(`Dataset schema — tables: ${tablesSummary}`);
        }
        if (schema.measures.length > 0) {
          evidence.push(`Measures: ${schema.measures.slice(0, 10).map((m) => m.name).join(", ")}`);
        }
      } catch (err) {
        evidence.push(`Schema fetch failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  } else {
    // Slow path: no context — enumerate from portal store + PBI API
    const svc = await getBiOperationsService();
    const syncedReports = svc.listReports().filter((r) => !r.isDeleted);
    usedTools.push("list_synced_reports");
    evidence.push(
      `Portal store: ${syncedReports.length} report(s): ${syncedReports.map((r) => r.displayName).slice(0, 10).join(", ")}`,
    );

    if (env.POWERBI_TENANT_ID && env.POWERBI_CLIENT_ID && env.POWERBI_CLIENT_SECRET) {
      try {
        const ctx = await fetchTenantContext(
          env.POWERBI_TENANT_ID, env.POWERBI_CLIENT_ID, env.POWERBI_CLIENT_SECRET,
        );
        usedTools.push("list_datasets", "list_reports");
        evidence.push(`Power BI tenant: ${ctx.datasets.length} dataset(s): ${ctx.datasets.map((d) => d.name).slice(0, 10).join(", ")}`);
        evidence.push(`Power BI tenant: ${ctx.reports.length} report(s): ${ctx.reports.map((r) => r.name).slice(0, 10).join(", ")}`);
      } catch (err) {
        evidence.push(`Power BI API: ${err instanceof Error ? err.message : "unavailable"}`);
      }
    } else {
      evidence.push("Power BI credentials not configured — using portal store only.");
    }
  }

  emitAudit({
    kind: "agent.query",
    userId: user.userId,
    tenantId: user.tenantId,
    metadata: { questionLength: question.length, tools: usedTools, reportId: reportContext?.reportId },
  });

  if (!env.ANTHROPIC_API_KEY) {
    return {
      answer: "AI analyst is not configured. Please set ANTHROPIC_API_KEY in the environment variables.",
      evidence,
      usedTools,
    };
  }

  let answer: string;
  try {
    answer = await generateAnthropicAnswer({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
      tenantId: user.tenantId,
      question,
      intent: "lookup",
      evidence,
      ...(reportContext ? { reportContext } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "anthropic_error";
    emitAudit({
      kind: "agent.query.llm_error",
      userId: user.userId,
      tenantId: user.tenantId,
      metadata: { message: msg },
    });
    throw new Error(`AI analyst failed: ${msg}`);
  }

  return { answer, evidence, usedTools };
}
