import { PolicyEngine, emitAudit } from "@portal/agent-core";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";
import { loadEnv } from "./env";
import { generateAnthropicAnswer, generateDaxQuery } from "./llm-anthropic";
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

// Strip [TableName][ColumnName] → ColumnName, or [ColumnName] → ColumnName
function cleanDaxKey(k: string): string {
  if (!k.includes("[")) return k;
  const last = k.split("[").pop();
  return last ? last.replace("]", "") : k;
}

const AUTO_TABLE_PREFIXES = ["DateTableTemplate_", "LocalDateTable_", "RowNumber-"];

async function fetchDatasetSchema(
  workspaceId: string,
  datasetId: string,
  token: string,
): Promise<{ tables: PbiTable[]; measures: PbiMeasure[] }> {
  // INFO functions via executeQueries work for all dataset types (imported, DirectQuery, Direct Lake).
  // The REST /tables endpoint only works for push datasets — returns empty for everything else.
  const [columnsResult, measuresResult] = await Promise.allSettled([
    executeDaxQuery(
      workspaceId, datasetId, token,
      "EVALUATE SELECTCOLUMNS(FILTER(INFO.COLUMNS(), NOT [IsHidden]), \"TableName\", [TableName], \"ColumnName\", [Name], \"DataType\", [DataType])",
    ),
    executeDaxQuery(
      workspaceId, datasetId, token,
      "EVALUATE SELECTCOLUMNS(INFO.MEASURES(), \"MeasureName\", [Name], \"TableName\", [TableName], \"Expression\", [Expression])",
    ),
  ]);

  let tables: PbiTable[] = [];
  let measures: PbiMeasure[] = [];

  if (columnsResult.status === "fulfilled" && !columnsResult.value.error && columnsResult.value.rows.length > 0) {
    const tableMap = new Map<string, Array<{ name: string; dataType: string }>>();
    for (const row of columnsResult.value.rows) {
      const tableName = String(row["[TableName]"] ?? "");
      const colName = String(row["[ColumnName]"] ?? "");
      const dataType = String(row["[DataType]"] ?? "");
      if (!tableName || !colName) continue;
      if (AUTO_TABLE_PREFIXES.some((p) => tableName.startsWith(p))) continue;
      if (!tableMap.has(tableName)) tableMap.set(tableName, []);
      tableMap.get(tableName)!.push({ name: colName, dataType });
    }
    tables = Array.from(tableMap.entries()).map(([name, columns]) => ({ name, columns }));
  } else {
    // Fallback: REST /tables endpoint (push datasets only)
    const res = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/tables`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) {
      tables = ((await res.json()) as { value: PbiTable[] }).value ?? [];
    }
  }

  if (measuresResult.status === "fulfilled" && !measuresResult.value.error) {
    measures = measuresResult.value.rows
      .map((row) => ({
        name: String(row["[MeasureName]"] ?? ""),
        expression: String(row["[Expression]"] ?? ""),
      }))
      .filter((m) => m.name);
  }

  return { tables, measures };
}

interface PbiRefreshEntry {
  requestId?: string;
  refreshType?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  serviceExceptionJson?: string;
}

async function fetchRefreshStatus(
  workspaceId: string,
  datasetId: string,
  token: string,
): Promise<PbiRefreshEntry | undefined> {
  const res = await fetch(
    `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/refreshes?$top=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return undefined;
  const json = (await res.json()) as { value?: PbiRefreshEntry[] };
  return json.value?.[0];
}

interface DaxQueryResult {
  results?: Array<{ tables?: Array<{ rows?: Array<Record<string, unknown>> }> }>;
  error?: { code?: string; pbi_error?: { code?: string; details?: Array<{ detail?: { value?: string } }> } };
}

async function executeDaxQuery(
  workspaceId: string,
  datasetId: string,
  token: string,
  daxQuery: string,
): Promise<{ rows: Array<Record<string, unknown>>; error?: string }> {
  const res = await fetch(
    `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: [{ query: daxQuery }],
        serializerSettings: { includeNulls: true },
      }),
    },
  );
  const json = (await res.json()) as DaxQueryResult;
  if (!res.ok || json.error) {
    const detail =
      json.error?.pbi_error?.details?.[0]?.detail?.value ??
      json.error?.pbi_error?.code ??
      json.error?.code ??
      `HTTP ${res.status}`;
    return { rows: [], error: detail };
  }
  const rows = json.results?.[0]?.tables?.[0]?.rows ?? [];
  return { rows };
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

    // Enrich with live schema, refresh status, and DAX query results
    if (env.POWERBI_TENANT_ID && env.POWERBI_CLIENT_ID && env.POWERBI_CLIENT_SECRET) {
      let token: string;
      try {
        token = await fetchPowerBiToken(
          env.POWERBI_TENANT_ID, env.POWERBI_CLIENT_ID, env.POWERBI_CLIENT_SECRET,
        );
      } catch (err) {
        evidence.push(`Power BI auth failed: ${err instanceof Error ? err.message : "unknown"}`);
        token = "";
      }

      if (token) {
        // Schema + refresh status run in parallel
        const [schemaResult, refreshEntry] = await Promise.allSettled([
          fetchDatasetSchema(reportContext.workspaceId, reportContext.datasetId, token),
          fetchRefreshStatus(reportContext.workspaceId, reportContext.datasetId, token),
        ]);

        let schema: { tables: PbiTable[]; measures: PbiMeasure[] } = { tables: [], measures: [] };
        if (schemaResult.status === "fulfilled") {
          usedTools.push("get_dataset_schema");
          schema = schemaResult.value;
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
        } else {
          evidence.push(`Schema fetch failed: ${schemaResult.reason instanceof Error ? schemaResult.reason.message : "unknown"}`);
        }

        if (refreshEntry.status === "fulfilled" && refreshEntry.value) {
          usedTools.push("get_refresh_status");
          const r = refreshEntry.value;
          const when = r.endTime ?? r.startTime ?? "unknown time";
          const statusLine = r.status === "Failed" && r.serviceExceptionJson
            ? `Failed — ${r.serviceExceptionJson.slice(0, 120)}`
            : (r.status ?? "Unknown");
          evidence.push(`Dataset refresh: ${statusLine} (${when})`);
        }

        // Execute a DAX query if schema is available and the API key is set for query generation
        if (schema.tables.length > 0 && env.ANTHROPIC_API_KEY) {
          try {
            const daxQuery = await generateDaxQuery({
              apiKey: env.ANTHROPIC_API_KEY,
              model: env.ANTHROPIC_MODEL,
              question,
              schema,
            });
            usedTools.push("execute_dax_query");
            const { rows, error: daxError } = await executeDaxQuery(
              reportContext.workspaceId, reportContext.datasetId, token, daxQuery,
            );
            if (daxError) {
              evidence.push(`DAX query failed: ${daxError}`);
            } else if (rows.length > 0) {
              // Serialize up to 20 rows; strip [Table][Column] → Column
              const clean = rows.slice(0, 20).map((row) =>
                Object.fromEntries(Object.entries(row).map(([k, v]) => [cleanDaxKey(k), v])),
              );
              evidence.push(`Query results (${rows.length} row${rows.length === 1 ? "" : "s"}):\n${JSON.stringify(clean, null, 2)}`);
            } else {
              evidence.push("DAX query returned no rows.");
            }
          } catch (err) {
            evidence.push(`DAX generation/execution failed: ${err instanceof Error ? err.message : "unknown"}`);
          }
        }
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
