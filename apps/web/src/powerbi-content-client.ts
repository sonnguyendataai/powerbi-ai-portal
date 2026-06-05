import { createHash } from "node:crypto";
import { loadEnv } from "./env";

export interface PowerBiWorkspaceContent {
  workspaceId: string;
  workspaceName: string;
  datasets: Array<{ id: string; name: string; configuredBy?: string }>;
  reports: Array<{ id: string; name: string; datasetId?: string; embedUrl: string }>;
  pagesByReportId: Record<string, Array<{ id: string; name: string; displayName: string; order: number }>>;
  warnings?: PowerBiContentWarning[];
}

const DEFAULT_BASE_URL = "https://api.powerbi.com/v1.0/myorg";

export interface PowerBiContentWarning {
  kind: "pages_unavailable";
  workspaceId: string;
  reportId: string;
  status: number;
  message: string;
}

export interface PowerBiDiagnosticsInput {
  workspaceId?: string;
  reportId?: string;
}

export interface PowerBiDiagnosticsStep {
  name: string;
  path: string;
  ok: boolean;
  status?: number;
  requestId?: string;
  body?: string;
  itemCount?: number;
  message?: string;
}

export interface PowerBiDiagnosticsResult {
  token: {
    acquired: boolean;
    aud?: string;
    appid?: string;
    tid?: string;
    roles?: string[];
  };
  steps: PowerBiDiagnosticsStep[];
}

export class PowerBiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly body: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "PowerBiApiError";
  }
}

export async function fetchPowerBiContent(mode: "full" | "workspace", workspaceId?: string): Promise<PowerBiWorkspaceContent[]> {
  const env = loadEnv(process.env);
  if (!env.POWERBI_TENANT_ID || !env.POWERBI_CLIENT_ID || !env.POWERBI_CLIENT_SECRET) {
    throw new Error("Power BI credentials are not configured.");
  }
  const token = await fetchAccessToken({
    tenantId: env.POWERBI_TENANT_ID,
    clientId: env.POWERBI_CLIENT_ID,
    clientSecret: env.POWERBI_CLIENT_SECRET,
  });
  const base = env.POWERBI_API_BASE_URL ?? DEFAULT_BASE_URL;
  const workspaces = mode === "workspace"
    ? [{ id: workspaceId ?? "", name: workspaceId ?? "" }]
    : await listWorkspaces(base, token);

  const result: PowerBiWorkspaceContent[] = [];
  for (const workspace of workspaces) {
    if (!workspace.id) continue;
    const [datasets, reports] = await Promise.all([
      listDatasets(base, token, workspace.id),
      listReports(base, token, workspace.id),
    ]);
    const pagesByReportId: PowerBiWorkspaceContent["pagesByReportId"] = {};
    const warnings: PowerBiContentWarning[] = [];
    for (const report of reports) {
      try {
        pagesByReportId[report.id] = await listPages(base, token, workspace.id, report.id);
      } catch (error) {
        if (error instanceof PowerBiApiError && [401, 403].includes(error.status)) {
          pagesByReportId[report.id] = [];
          warnings.push({
            kind: "pages_unavailable",
            workspaceId: workspace.id,
            reportId: report.id,
            status: error.status,
            message: error.message,
          });
          continue;
        }
        throw error;
      }
    }
    result.push({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      datasets,
      reports,
      pagesByReportId,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  }
  return result;
}

export async function diagnosePowerBiAccess(input: PowerBiDiagnosticsInput): Promise<PowerBiDiagnosticsResult> {
  const env = loadEnv(process.env);
  if (!env.POWERBI_TENANT_ID || !env.POWERBI_CLIENT_ID || !env.POWERBI_CLIENT_SECRET) {
    throw new Error("Power BI credentials are not configured.");
  }
  const token = await fetchAccessToken({
    tenantId: env.POWERBI_TENANT_ID,
    clientId: env.POWERBI_CLIENT_ID,
    clientSecret: env.POWERBI_CLIENT_SECRET,
  });
  const base = env.POWERBI_API_BASE_URL ?? DEFAULT_BASE_URL;
  const diagnostics: PowerBiDiagnosticsResult = {
    token: {
      acquired: true,
      ...decodeTokenClaims(token),
    },
    steps: [],
  };

  await addDiagnosticStep(diagnostics, base, token, "list_workspaces", "/groups");
  if (input.workspaceId) {
    await addDiagnosticStep(diagnostics, base, token, "list_workspace_reports", `/groups/${input.workspaceId}/reports`);
    await addDiagnosticStep(diagnostics, base, token, "list_workspace_datasets", `/groups/${input.workspaceId}/datasets`);
  }
  if (input.workspaceId && input.reportId) {
    await addDiagnosticStep(
      diagnostics,
      base,
      token,
      "list_report_pages",
      `/groups/${input.workspaceId}/reports/${input.reportId}/pages`,
    );
  }
  return diagnostics;
}

export function hashContent(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 16);
}

async function fetchAccessToken(input: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    scope: "https://analysis.windows.net/powerbi/api/.default",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(input.tenantId)}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form },
  );
  if (!res.ok) throw new Error(`Power BI OAuth failed (${res.status})`);
  const json = await res.json() as { access_token?: unknown };
  const token = typeof json.access_token === "string" ? json.access_token : "";
  if (!token) throw new Error("Power BI OAuth response missing access token");
  return token;
}

async function listWorkspaces(base: string, token: string): Promise<Array<{ id: string; name: string }>> {
  const json = await getJson(base, token, "/groups");
  const items = Array.isArray(json.value) ? json.value : [];
  return items.map((item) => ({
    id: typeof item.id === "string" ? item.id : "",
    name: typeof item.name === "string" ? item.name : "",
  })).filter((item) => !!item.id);
}

async function listDatasets(
  base: string,
  token: string,
  workspaceId: string,
): Promise<Array<{ id: string; name: string; configuredBy?: string }>> {
  const json = await getJson(base, token, `/groups/${workspaceId}/datasets`);
  const items = Array.isArray(json.value) ? json.value : [];
  return items.map((item) => ({
    id: typeof item.id === "string" ? item.id : "",
    name: typeof item.name === "string" ? item.name : "",
    ...(typeof item.configuredBy === "string" ? { configuredBy: item.configuredBy } : {}),
  })).filter((item) => !!item.id);
}

async function listReports(
  base: string,
  token: string,
  workspaceId: string,
): Promise<Array<{ id: string; name: string; datasetId?: string; embedUrl: string }>> {
  const json = await getJson(base, token, `/groups/${workspaceId}/reports`);
  const items = Array.isArray(json.value) ? json.value : [];
  return items.map((item) => ({
    id: typeof item.id === "string" ? item.id : "",
    name: typeof item.name === "string" ? item.name : "",
    embedUrl: typeof item.embedUrl === "string" ? item.embedUrl : "",
    ...(typeof item.datasetId === "string" ? { datasetId: item.datasetId } : {}),
  })).filter((item) => !!item.id && !!item.embedUrl);
}

async function listPages(
  base: string,
  token: string,
  workspaceId: string,
  reportId: string,
): Promise<Array<{ id: string; name: string; displayName: string; order: number }>> {
  const json = await getJson(base, token, `/groups/${workspaceId}/reports/${reportId}/pages`);
  const items = Array.isArray(json.value) ? json.value : [];
  return items.map((item, idx) => ({
    id: typeof item.name === "string" ? `${reportId}:${item.name}` : `${reportId}:page-${idx}`,
    name: typeof item.name === "string" ? item.name : `page-${idx}`,
    displayName: typeof item.displayName === "string" ? item.displayName : `Page ${idx + 1}`,
    order: typeof item.order === "number" ? item.order : idx,
  }));
}

async function getJson(base: string, token: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await safeReadBody(res);
    const requestId = res.headers.get("requestid") ?? res.headers.get("x-ms-request-id") ?? undefined;
    const bodySuffix = body ? ` body=${truncate(body, 600)}` : "";
    const requestSuffix = requestId ? ` requestId=${requestId}` : "";
    throw new PowerBiApiError(
      `Power BI API failed (${res.status}) on ${path}${requestSuffix}${bodySuffix}`,
      res.status,
      path,
      body,
      requestId,
    );
  }
  return await res.json() as Record<string, unknown>;
}

async function addDiagnosticStep(
  result: PowerBiDiagnosticsResult,
  base: string,
  token: string,
  name: string,
  path: string,
): Promise<void> {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const body = await safeReadBody(res);
  const parsed = parseMaybeJson(body);
  const itemCount = typeof parsed === "object" && parsed && Array.isArray((parsed as { value?: unknown }).value)
    ? (parsed as { value: unknown[] }).value.length
    : undefined;
  const requestId = res.headers.get("requestid") ?? res.headers.get("x-ms-request-id") ?? undefined;
  result.steps.push({
    name,
    path,
    ok: res.ok,
    status: res.status,
    ...(requestId ? { requestId } : {}),
    ...(body ? { body: truncate(body, 1200) } : {}),
    ...(itemCount !== undefined ? { itemCount } : {}),
    ...(!res.ok ? { message: `Power BI API failed (${res.status}) on ${path}` } : {}),
  });
}

function decodeTokenClaims(token: string): Omit<PowerBiDiagnosticsResult["token"], "acquired"> {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      aud?: unknown;
      appid?: unknown;
      tid?: unknown;
      roles?: unknown;
    };
    return {
      ...(typeof claims.aud === "string" ? { aud: claims.aud } : {}),
      ...(typeof claims.appid === "string" ? { appid: claims.appid } : {}),
      ...(typeof claims.tid === "string" ? { tid: claims.tid } : {}),
      ...(Array.isArray(claims.roles) ? { roles: claims.roles.filter((role): role is string => typeof role === "string") } : {}),
    };
  } catch {
    return {};
  }
}

async function safeReadBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function parseMaybeJson(input: string): unknown {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
