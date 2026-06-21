// Shared Power BI helpers used by the AI agent, Chart Studio, and Data Prep:
// service-principal auth, executeQueries (DAX), error extraction, and live
// semantic-model schema discovery via the INFO.VIEW.* DAX functions.

export interface PbiTable {
  name: string;
  columns: Array<{ name: string; dataType: string }>;
}
export interface PbiMeasure {
  name: string;
  expression: string;
}
export interface DatasetSchema {
  tables: PbiTable[];
  measures: PbiMeasure[];
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

async function fetchToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  scope: string,
  label: string,
): Promise<string> {
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form },
  );
  if (!res.ok) throw new Error(`${label} OAuth failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error(`${label} OAuth response missing access_token`);
  return json.access_token;
}

export async function fetchPowerBiToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  return fetchToken(tenantId, clientId, clientSecret, "https://analysis.windows.net/powerbi/api/.default", "Power BI");
}

// Fabric APIs (api.fabric.microsoft.com) require a token for the Fabric audience.
// The same service principal works as long as it has the Fabric scopes granted
// and is a Contributor on the target workspace.
export async function fetchFabricToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  return fetchToken(tenantId, clientId, clientSecret, "https://api.fabric.microsoft.com/.default", "Fabric");
}

// Strip [TableName][ColumnName] → ColumnName, or [ColumnName] → ColumnName.
// Power BI executeQueries returns keys in the form "TableName[ColumnName]".
export function cleanDaxKey(k: string): string {
  const bracket = k.indexOf("[");
  if (bracket === -1) return k;
  return k.slice(bracket + 1).replace("]", "");
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
  // Keep the code as a suffix when we also have a message, so callers can
  // distinguish an API-gate error from a DAX name error.
  const primary = fromDetails ?? fromMessage ?? fromPbiCode ?? fromCode;
  if (primary && fromCode && primary !== fromCode) return `${primary} (${fromCode})`;
  return primary ?? (httpStatus ? `HTTP ${httpStatus}` : "unknown error");
}

export async function executeDaxQuery(
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

export async function fetchDatasetSchema(
  workspaceId: string,
  datasetId: string,
  token: string,
): Promise<DatasetSchema> {
  // Fetch the live semantic-model schema via the DAX INFO.VIEW.* functions.
  //
  // Why not REST /datasets/{id}/tables: it only returns data for Push datasets;
  // imported / DirectQuery / Direct Lake models return an empty list, leaving
  // generators to GUESS table and column names.
  //
  // Why INFO.VIEW.* and not INFO.COLUMNS/INFO.MEASURES: executeQueries blocks
  // the DMV-style INFO functions, but INFO.VIEW.TABLES/COLUMNS/MEASURES are real
  // DAX functions and execute through executeQueries. Keep hidden objects (date
  // dimensions/keys are often hidden); drop only the internal RowNumber column.
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

// Compact, human-readable schema string for embedding in LLM prompts.
export function summarizeSchema(schema: DatasetSchema, maxTables = 50, maxCols = 30): string {
  if (schema.tables.length === 0) return "(schema unavailable)";
  const tables = schema.tables
    .slice(0, maxTables)
    .map((t) => `${t.name}(${t.columns.slice(0, maxCols).map((c) => `${c.name}:${c.dataType}`).join(", ")})`)
    .join("\n");
  const measures = schema.measures.length > 0
    ? `\nMeasures: ${schema.measures.slice(0, 60).map((m) => `[${m.name}]`).join(", ")}`
    : "";
  return tables + measures;
}
