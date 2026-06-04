import { createHash } from "node:crypto";
import { loadEnv } from "./env";

export interface PowerBiWorkspaceContent {
  workspaceId: string;
  workspaceName: string;
  datasets: Array<{ id: string; name: string; configuredBy?: string }>;
  reports: Array<{ id: string; name: string; datasetId?: string; embedUrl: string }>;
  pagesByReportId: Record<string, Array<{ id: string; name: string; displayName: string; order: number }>>;
}

const DEFAULT_BASE_URL = "https://api.powerbi.com/v1.0/myorg";

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
    for (const report of reports) {
      pagesByReportId[report.id] = await listPages(base, token, workspace.id, report.id);
    }
    result.push({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      datasets,
      reports,
      pagesByReportId,
    });
  }
  return result;
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
  if (!res.ok) throw new Error(`Power BI API failed (${res.status}) on ${path}`);
  return await res.json() as Record<string, unknown>;
}
