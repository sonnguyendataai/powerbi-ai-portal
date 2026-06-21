// Builds a minimal Power BI Enhanced Report (PBIR) definition from a generated
// chart spec and creates it as a real report via the Fabric Create Report API.
//
// PBIR is a public, file-based report format (definition.pbir + report.json +
// pages/<page>/page.json + pages/<page>/visuals/<visual>/visual.json + version
// files). The Fabric Items - Create Report API accepts these files base64-encoded
// as definition.parts[]. The report must reference the target semantic model
// through a `byConnection` datasetReference (REST deployments require byConnection,
// and only need `semanticmodelid=<id>`).
//
// Requires: a Fabric/Premium/PPU-backed workspace, the service principal as a
// workspace Contributor, and the Fabric scopes granted to the app. On non-Fabric
// (shared) capacity the API returns an error, which we surface verbatim.

import type { ChartFieldBinding, GeneratedChartSpec } from "./llm-anthropic";

const PBIR_DEFINITION_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json";
const PBIR_REPORT_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/1.0.0/schema.json";
const PBIR_PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/1.0.0/schema.json";
const PBIR_PAGES_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json";
const PBIR_VISUAL_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.0.0/schema.json";
const PBIR_VERSION_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json";

// Map our chart types to Power BI visual type names.
const VISUAL_TYPE: Record<GeneratedChartSpec["chartType"], string> = {
  bar: "clusteredColumnChart",
  line: "lineChart",
  area: "areaChart",
  scatter: "scatterChart",
  table: "tableEx",
};

// Which projection role each axis maps to per visual type.
function rolesFor(chartType: GeneratedChartSpec["chartType"]): { category: string; value: string } {
  if (chartType === "scatter") return { category: "X", value: "Y" };
  if (chartType === "table") return { category: "Values", value: "Values" };
  return { category: "Category", value: "Y" };
}

function b64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

function aggFunction(agg: ChartFieldBinding["aggregation"]): number | undefined {
  // Power BI query aggregation function enum.
  switch (agg) {
    case "sum": return 0;
    case "average": return 1;
    case "min": return 2;
    case "max": return 3;
    case "count": return 4;
    default: return undefined;
  }
}

// Build a single field expression for a projection. Column vs measure vs
// aggregated column produce different query expressions.
function fieldExpression(binding: ChartFieldBinding): Record<string, unknown> {
  const sourceRef = { Expression: { SourceRef: { Entity: binding.table } }, Property: binding.field };
  if (binding.isMeasure) {
    return { Measure: sourceRef };
  }
  const agg = aggFunction(binding.aggregation);
  if (agg !== undefined) {
    return { Aggregation: { Expression: { Column: sourceRef }, Function: agg } };
  }
  return { Column: sourceRef };
}

function projection(binding: ChartFieldBinding): Record<string, unknown> {
  const queryRef = binding.isMeasure
    ? `${binding.table}.${binding.field}`
    : binding.aggregation && binding.aggregation !== "none"
      ? `${capitalize(binding.aggregation)}(${binding.table}.${binding.field})`
      : `${binding.table}.${binding.field}`;
  return {
    field: fieldExpression(binding),
    queryRef,
    nativeQueryRef: binding.field,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface PbirPart {
  path: string;
  payload: string;
  payloadType: "InlineBase64";
}

// Produce the PBIR definition parts for a one-page, one-visual report bound to
// the given semantic model.
export function buildReportDefinitionParts(
  spec: GeneratedChartSpec,
  semanticModelId: string,
): PbirPart[] {
  const pageName = "page1";
  const visualName = "visual1";
  const roles = rolesFor(spec.chartType);

  // definition.pbir — references the semantic model by connection (REST deploy
  // only needs semanticmodelid).
  const definitionPbir = {
    $schema: PBIR_DEFINITION_SCHEMA,
    version: "4.0",
    datasetReference: {
      byConnection: { connectionString: `semanticmodelid=${semanticModelId}` },
    },
  };

  const reportJson = {
    $schema: PBIR_REPORT_SCHEMA,
    themeCollection: { baseTheme: { name: "CY24SU06", type: "SharedResources" } },
    layoutOptimization: "None",
  };

  const versionJson = { $schema: PBIR_VERSION_SCHEMA, version: "2.0.0" };

  const pagesJson = {
    $schema: PBIR_PAGES_SCHEMA,
    pageOrder: [pageName],
    activePageName: pageName,
  };

  const pageJson = {
    $schema: PBIR_PAGE_SCHEMA,
    name: pageName,
    displayName: spec.title || "Page 1",
    displayOption: "FitToPage",
    height: 720,
    width: 1280,
  };

  // Assemble visual projections from whichever bindings are present.
  const projections: Record<string, Array<Record<string, unknown>>> = {};
  if (spec.xBinding) {
    projections[roles.category] = [projection(spec.xBinding)];
  }
  if (spec.yBinding) {
    const valueRole = roles.value;
    projections[valueRole] = [...(projections[valueRole] ?? []), projection(spec.yBinding)];
  }

  const visualJson = {
    $schema: PBIR_VISUAL_SCHEMA,
    name: visualName,
    position: { x: 16, y: 16, z: 0, width: 1248, height: 688, tabOrder: 0 },
    visual: {
      visualType: VISUAL_TYPE[spec.chartType],
      query: {
        queryState: Object.fromEntries(
          Object.entries(projections).map(([role, projs]) => [role, { projections: projs }]),
        ),
      },
      objects: {
        title: [{ properties: { text: { expr: { Literal: { Value: `'${(spec.title || "Visual").replace(/'/g, "")}'` } } } } }],
      },
    },
  };

  return [
    { path: "definition.pbir", payload: b64(definitionPbir), payloadType: "InlineBase64" },
    { path: "definition/report.json", payload: b64(reportJson), payloadType: "InlineBase64" },
    { path: "definition/version.json", payload: b64(versionJson), payloadType: "InlineBase64" },
    { path: "definition/pages/pages.json", payload: b64(pagesJson), payloadType: "InlineBase64" },
    { path: `definition/pages/${pageName}/page.json`, payload: b64(pageJson), payloadType: "InlineBase64" },
    {
      path: `definition/pages/${pageName}/visuals/${visualName}/visual.json`,
      payload: b64(visualJson),
      payloadType: "InlineBase64",
    },
  ];
}

export interface CreateReportResult {
  reportId: string;
  status: "created";
}

// Create the report via the Fabric Items API. Handles the 202 long-running
// operation by polling the returned operation until it completes.
export async function createFabricReport(input: {
  fabricToken: string;
  workspaceId: string;
  semanticModelId: string;
  displayName: string;
  spec: GeneratedChartSpec;
}): Promise<CreateReportResult> {
  const parts = buildReportDefinitionParts(input.spec, input.semanticModelId);
  const res = await fetch(
    `https://api.fabric.microsoft.com/v1/workspaces/${input.workspaceId}/reports`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${input.fabricToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: input.displayName,
        definition: { parts },
      }),
    },
  );

  if (res.status === 201) {
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error("Fabric create report returned no id");
    return { reportId: json.id, status: "created" };
  }

  if (res.status === 202) {
    const operationUrl = res.headers.get("Location");
    if (!operationUrl) throw new Error("Fabric accepted the request but returned no operation Location");
    const reportId = await pollFabricOperation(operationUrl, input.fabricToken);
    return { reportId, status: "created" };
  }

  const body = await res.text().catch(() => "");
  throw new Error(`Fabric create report failed (${res.status})${body ? `: ${truncate(body, 400)}` : ""}`);
}

async function pollFabricOperation(operationUrl: string, token: string, maxAttempts = 20): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await delay(1500);
    const res = await fetch(operationUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Fabric operation poll failed (${res.status})${body ? `: ${truncate(body, 300)}` : ""}`);
    }
    const json = (await res.json()) as { status?: string; error?: { message?: string } };
    if (json.status === "Succeeded") {
      // Result holds the created item; fetch it from the operation result endpoint.
      const resultRes = await fetch(`${operationUrl}/result`, { headers: { Authorization: `Bearer ${token}` } });
      if (resultRes.ok) {
        const result = (await resultRes.json()) as { id?: string };
        if (result.id) return result.id;
      }
      return "";
    }
    if (json.status === "Failed") {
      throw new Error(`Fabric report creation failed: ${json.error?.message ?? "unknown error"}`);
    }
  }
  throw new Error("Fabric report creation timed out");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
