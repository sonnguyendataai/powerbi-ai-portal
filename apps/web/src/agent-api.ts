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
// Power BI executeQueries returns keys in the form "TableName[ColumnName]"
function cleanDaxKey(k: string): string {
  const bracket = k.indexOf("[");
  if (bracket === -1) return k;
  return k.slice(bracket + 1).replace("]", "");
}

async function fetchDatasetSchema(
  workspaceId: string,
  datasetId: string,
  token: string,
): Promise<{ tables: PbiTable[]; measures: PbiMeasure[] }> {
  // Fetch the live semantic-model schema via the DAX INFO.VIEW.* functions.
  //
  // Why not REST /datasets/{id}/tables: it only returns data for Push datasets;
  // imported / DirectQuery / Direct Lake models return an empty list, leaving
  // the DAX generator to GUESS table and column names — the root cause of
  // "Cannot find table 'Date'".
  //
  // Why INFO.VIEW.* and not INFO.COLUMNS/INFO.MEASURES: executeQueries blocks
  // the DMV-style INFO functions ("INFO functions and DMV queries are not
  // supported"), but INFO.VIEW.TABLES/COLUMNS/MEASURES are real DAX functions
  // (per Microsoft docs they work in calculated tables/columns/measures), so
  // they execute through executeQueries. Requires a recent compatibility level;
  // on older models the query errors and we fall back to schema-free generation.
  // Keep hidden columns/measures: they are still queryable in DAX, and date
  // dimensions or key columns are often hidden — excluding them would recreate
  // the "Cannot find table 'Date'" failure. Only drop the internal RowNumber
  // column, which cannot be referenced in a query.
  const [colsRes, measuresRes] = await Promise.all([
    executeDaxQuery(
      workspaceId, datasetId, token,
      'EVALUATE SELECTCOLUMNS(FILTER(INFO.VIEW.COLUMNS(), [DataCategory] <> "RowNumber"), "Table", [Table], "Column", [Name], "DataType", [DataType])',
    ),
    executeDaxQuery(
      workspaceId, datasetId, token,
      'EVALUATE SELECTCOLUMNS(INFO.VIEW.MEASURES(), "Table", [Table], "Measure", [Name])',
    ),
  ]);

  const tableMap = new Map<string, PbiTable>();
  for (const row of colsRes.rows) {
    const clean = Object.fromEntries(Object.entries(row).map(([k, v]) => [cleanDaxKey(k), v]));
    const tableName = typeof clean.Table === "string" ? clean.Table : "";
    const columnName = typeof clean.Column === "string" ? clean.Column : "";
    const dataType = typeof clean.DataType === "string" ? clean.DataType : "";
    if (!tableName || !columnName) continue;
    let entry = tableMap.get(tableName);
    if (!entry) {
      entry = { name: tableName, columns: [] };
      tableMap.set(tableName, entry);
    }
    entry.columns.push({ name: columnName, dataType });
  }

  const measures: PbiMeasure[] = [];
  for (const row of measuresRes.rows) {
    const clean = Object.fromEntries(Object.entries(row).map(([k, v]) => [cleanDaxKey(k), v]));
    const measureName = typeof clean.Measure === "string" ? clean.Measure : "";
    if (measureName) measures.push({ name: measureName, expression: "" });
  }

  if (tableMap.size > 0) {
    return { tables: [...tableMap.values()], measures };
  }

  // INFO.VIEW.* returned nothing (older compatibility level, or the call
  // errored). Fall back to the REST /tables endpoint — it only populates for
  // Push datasets, but it is harmless and better than an empty schema.
  const res = await fetch(
    `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/tables`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const tables: PbiTable[] = res.ok ? ((await res.json()) as { value: PbiTable[] }).value ?? [] : [];
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

interface PbiErrorDetail {
  code?: string;
  detail?: { type?: number; value?: string };
}
interface PbiInnerError {
  code?: string;
  details?: PbiErrorDetail[];
}
export interface PbiQueryError {
  code?: string;
  message?: string;
  // NOTE: the Power BI error envelope key is literally "pbi.error" (with a dot),
  // not "pbi_error". The human-readable DAX failure (e.g. "Column 'Revenue'
  // cannot be found") lives in its details[].detail.value. Reading it under the
  // wrong key silently drops the message and leaves only the generic code.
  "pbi.error"?: PbiInnerError;
}

interface DaxQueryResult {
  results?: Array<{
    tables?: Array<{ rows?: Array<Record<string, unknown>>; error?: PbiQueryError }>;
    error?: PbiQueryError;
  }>;
  error?: PbiQueryError;
}

export function extractPbiErrorMessage(err: PbiQueryError | undefined, httpStatus?: number): string {
  if (!err) return httpStatus ? `HTTP ${httpStatus}` : "unknown error";
  // Prefer the human-readable detail message over generic codes. The detail
  // that carries the actual DAX failure text is the longest non-empty value.
  const inner = err["pbi.error"];
  const detailValues = (inner?.details ?? [])
    .map((d) => d.detail?.value)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const fromDetails = detailValues.sort((a, b) => b.length - a.length)[0];
  const fromMessage = err.message && err.message.trim().length > 0 ? err.message : undefined;
  const fromPbiCode = inner?.code;
  const fromCode = err.code;
  // Keep the code as a suffix when we also have a message, so the answer can
  // distinguish an API-gate error from a DAX name error.
  const primary = fromDetails ?? fromMessage ?? fromPbiCode ?? fromCode;
  if (primary && fromCode && primary !== fromCode) return `${primary} (${fromCode})`;
  return primary ?? (httpStatus ? `HTTP ${httpStatus}` : "unknown error");
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

  // Top-level error: HTTP 4xx/5xx — auth failure, tenant setting disabled, insufficient scope
  if (!res.ok || json.error) {
    return { rows: [], error: extractPbiErrorMessage(json.error, res.status) };
  }

  // Per-query error: HTTP 200 but DAX evaluation failed (wrong table/column name lands here)
  const queryResult = json.results?.[0];
  if (queryResult?.error) {
    return { rows: [], error: extractPbiErrorMessage(queryResult.error) };
  }

  // Per-table error: partial success — some rows may exist alongside an error
  const tableResult = queryResult?.tables?.[0];
  if (tableResult?.error) {
    return { rows: tableResult.rows ?? [], error: extractPbiErrorMessage(tableResult.error) };
  }

  return { rows: tableResult?.rows ?? [] };
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
              .slice(0, 30)
              .map((t) => `${t.name}(${t.columns.slice(0, 20).map((c) => `${c.name}:${c.dataType}`).join(", ")})`)
              .join("; ");
            evidence.push(`Dataset schema (${schema.tables.length} tables) — ${tablesSummary}`);
          }
          if (schema.measures.length > 0) {
            evidence.push(`Measures (${schema.measures.length}): ${schema.measures.slice(0, 40).map((m) => m.name).join(", ")}`);
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

        // Probe first with a trivial query to confirm executeQueries is permitted.
        // "DatasetExecuteQueriesError" as a top-level error code means the tenant setting
        // "Dataset Execute Queries REST API" is disabled, or the service principal lacks
        // Dataset.Read.All scope — no point generating DAX if the API gate is closed.
        if (env.ANTHROPIC_API_KEY) {
          const probe = await executeDaxQuery(
            reportContext.workspaceId, reportContext.datasetId, token,
            "EVALUATE ROW(\"ok\", 1)",
          );
          const apiBlocked = !!probe.error && probe.rows.length === 0;

          if (apiBlocked) {
            evidence.push(
              `executeQueries API blocked: ${probe.error}. ` +
              "Likely cause: tenant setting 'Dataset Execute Queries REST API' is disabled (Power BI Admin > Integration settings), " +
              "or service principal lacks Dataset.Read.All scope.",
            );
          } else {
            // API is open — generate and execute the real DAX query with one retry on name errors
            try {
              usedTools.push("execute_dax_query");
              let daxQuery = await generateDaxQuery({
                apiKey: env.ANTHROPIC_API_KEY,
                model: env.ANTHROPIC_MODEL,
                question,
                schema,
                reportName: reportContext.reportName,
              });

              let { rows, error: daxError } = await executeDaxQuery(
                reportContext.workspaceId, reportContext.datasetId, token, daxQuery,
              );

              // Retry once: feed the error and failed query back so Claude can fix table/column names
              if (daxError && !rows.length) {
                usedTools.push("execute_dax_query_retry");
                daxQuery = await generateDaxQuery({
                  apiKey: env.ANTHROPIC_API_KEY,
                  model: env.ANTHROPIC_MODEL,
                  question,
                  schema,
                  reportName: reportContext.reportName,
                  previousError: daxError,
                  previousQuery: daxQuery,
                });
                ({ rows, error: daxError } = await executeDaxQuery(
                  reportContext.workspaceId, reportContext.datasetId, token, daxQuery,
                ));
              }

              if (rows.length > 0) {
                const clean = rows.slice(0, 20).map((row) =>
                  Object.fromEntries(Object.entries(row).map(([k, v]) => [cleanDaxKey(k), v])),
                );
                evidence.push(`Query results (${rows.length} row${rows.length === 1 ? "" : "s"}):\n${JSON.stringify(clean, null, 2)}`);
                if (daxError) evidence.push(`(partial result — query warning: ${daxError})`);
              } else if (daxError) {
                evidence.push(`DAX query failed after retry: ${daxError}`);
              } else {
                evidence.push("DAX query returned no rows.");
              }
            } catch (err) {
              evidence.push(`DAX generation/execution failed: ${err instanceof Error ? err.message : "unknown"}`);
            }
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
