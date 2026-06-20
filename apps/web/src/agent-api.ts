import { PolicyEngine, emitAudit } from "@portal/agent-core";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";
import { loadEnv } from "./env";
import { generateAnthropicAnswer, generateDaxQuery } from "./llm-anthropic";
import { getBiOperationsService } from "./bi-ops";
import {
  cleanDaxKey,
  executeDaxQuery,
  fetchDatasetSchema,
  fetchPowerBiToken,
  type PbiMeasure,
  type PbiTable,
} from "./powerbi-schema";

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
