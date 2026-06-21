import Anthropic from "@anthropic-ai/sdk";
import type { ReportContext } from "./agent-api";

export interface AnthropicAnswerInput {
  apiKey: string;
  model: string;
  tenantId: string;
  question: string;
  intent: string;
  evidence: string[];
  reportContext?: ReportContext;
}

export interface DaxQueryInput {
  apiKey: string;
  model: string;
  question: string;
  reportName: string;
  schema: { tables: Array<{ name: string; columns: Array<{ name: string; dataType: string }> }>; measures: Array<{ name: string; expression: string }> };
  previousQuery?: string;
  previousError?: string;
}

const SYSTEM_PROMPT =
  "You are an enterprise BI analyst assistant embedded in a Power BI portal. " +
  "Be concise and factual. Use only the provided evidence — never invent numbers or metrics. " +
  "When dataset schema is available, reference specific table and column names in your answer. " +
  "Mention limitations clearly if evidence is incomplete.\n\n" +
  "DAX and model quality awareness:\n" +
  "- DIVIDE(numerator, denominator) is safe division; unguarded division with / causes errors on zero denominators.\n" +
  "- CALCULATE filters columns, not entire tables — filtering a table instead of a column is a common error.\n" +
  "- Calculated columns run in row context; measures run in filter context — mixing them causes silent wrong results.\n" +
  "- A KPI is only actionable if it answers: (1) is this good or bad? and (2) is it trending better or worse? Flag KPIs missing a target or variance.\n" +
  "- Apply the 20%-change test: if a metric shifted 20%, would someone act differently? If not, question its inclusion.\n" +
  "- Critical model issues: bidirectional relationships causing ambiguity, missing RLS, high-cardinality columns with isAvailableInMDX enabled, implicit measures.\n" +
  "- Report layout: KPIs at top-left, charts in centre, detail tables at bottom. Max 5–6 KPIs per page. Every KPI needs a target and a variance.";

export async function generateAnthropicAnswer(input: AnthropicAnswerInput): Promise<string> {
  const anthropic = new Anthropic({ apiKey: input.apiKey });
  const evidenceText = input.evidence.map((e, i) => `${i + 1}. ${e}`).join("\n");

  const reportSection = input.reportContext
    ? `\nActive report: "${input.reportContext.reportName}" | dataset ${input.reportContext.datasetId}\n`
    : "";

  const response = await anthropic.messages.create({
    model: input.model,
    max_tokens: 800,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Tenant: ${input.tenantId}${reportSection}\n` +
          `Question: ${input.question}\n\n` +
          `Evidence:\n${evidenceText}\n\n` +
          "Rules for your answer:\n" +
          "1. If 'Query results' appear in the evidence, lead with the actual numbers from those rows — state which year/value is highest, lowest, or most notable. Do NOT say 'no data available'.\n" +
          "2. If 'DAX query failed' appears, explain what went wrong briefly and answer based on available schema/metadata.\n" +
          "3. If no query results and no schema, say clearly what data you don't have and why, in one sentence.\n" +
          "4. Be direct and specific — cite exact numbers, years, and column names from the evidence.\n" +
          "5. Use 2–4 concise bullet points. No generic BI advice unless specifically asked.",
      },
    ],
  });

  const first = response.content[0];
  if (!first || first.type !== "text") return "Unable to generate answer.";
  return first.text.trim();
}

export async function generateDaxQuery(input: DaxQueryInput): Promise<string> {
  const anthropic = new Anthropic({ apiKey: input.apiKey });

  const hasSchema = input.schema.tables.length > 0;
  const tablesSummary = hasSchema
    ? input.schema.tables
        .slice(0, 50)
        .map((t) => `${t.name}(${t.columns.slice(0, 30).map((c) => `${c.name}:${c.dataType}`).join(", ")})`)
        .join("\n")
    : "(schema not available — infer from report name and question context)";
  const measuresSummary = input.schema.measures.slice(0, 60).map((m) => `[${m.name}]`).join(", ");

  const schemaInstruction = hasSchema
    ? "Every referenced table and column MUST exist exactly as listed in the schema above."
    : `No schema is available. Infer likely table and column names from the report name "${input.reportName}" and the question itself — do NOT assume any particular business domain. ` +
      "Derive the domain from the question's nouns (e.g. a question about products/revenue/sales implies fact tables like 'Sales'/'FactSales' with measures like 'Revenue'/'Sales Amount' and a 'Product'/'DimProduct' dimension; a question about employees implies HR tables). " +
      "Use a date/calendar dimension with a 'Year' column for year filters. " +
      "Prefer star-schema conventions (fact table + dimension tables). If you cannot produce a reliable query, " +
      "write one that surfaces an informative error rather than returning wrong data.";

  const response = await anthropic.messages.create({
    model: input.model,
    max_tokens: 600,
    temperature: 0,
    system:
      "You are a DAX query generator for Power BI. Output ONLY a valid DAX query starting with EVALUATE. " +
      "No explanation, no markdown fences, no comments, no trailing text. " +
      "Rules:\n" +
      "- Use SUMMARIZECOLUMNS for grouped aggregations.\n" +
      "- Use TOPN(50, ...) to limit rows when needed.\n" +
      "- Use DIVIDE(numerator, denominator, 0) — never bare /.\n" +
      "- Filter on columns, not whole tables inside CALCULATE/FILTER.\n" +
      "- Use ORDER BY at the end of EVALUATE when sorting is meaningful.\n" +
      "- For year-over-year trends: group by a Year column from a Date or Calendar table.\n" +
      "- For turnover/headcount: the measure is typically COUNTROWS or DISTINCTCOUNT over an Employee table filtered by status.\n" +
      "- The API returns rows as { 'TableName[ColumnName]': value } — this is normal.\n" +
      schemaInstruction,
    messages: [
      {
        role: "user",
        content:
          `Report: "${input.reportName}"\n\n` +
          `Schema:\n${tablesSummary}\n\n` +
          (measuresSummary ? `Known measures: ${measuresSummary}\n\n` : "") +
          (input.previousQuery && input.previousError
            ? `PREVIOUS ATTEMPT FAILED:\nQuery: ${input.previousQuery}\nError: ${input.previousError}\n\nThe table or column names above were wrong. Use the error message to infer the correct names and write a corrected query.\n\n`
            : "") +
          `Question: ${input.question}\n\n` +
          "Write the DAX EVALUATE query to answer this question. Return only the EVALUATE statement.",
      },
    ],
  });

  const first = response.content[0];
  if (!first || first.type !== "text") throw new Error("DAX generation produced no output");
  const text = first.text.trim();
  if (!text.toUpperCase().startsWith("EVALUATE")) throw new Error(`Generated text is not a DAX query: ${text.slice(0, 80)}`);
  return text;
}

// Extract a JSON object from a model response that may wrap it in prose or
// ```json fences. Returns the parsed object or throws.
function parseJsonObject(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Model did not return JSON: ${candidate.slice(0, 80)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}

export interface SchemaInput {
  tables: Array<{ name: string; columns: Array<{ name: string; dataType: string }> }>;
  measures: Array<{ name: string; expression: string }>;
}

export interface ChartSpecInput {
  apiKey: string;
  model: string;
  prompt: string;
  schema: SchemaInput;
  reportName?: string;
}

// A field binding the report builder can turn into a PBIR projection.
// `aggregation` applies to numeric column measures; omit for an explicit
// model measure or a categorical/date column.
export interface ChartFieldBinding {
  table: string;
  field: string;
  isMeasure: boolean;
  aggregation?: "sum" | "average" | "count" | "min" | "max" | "none";
}

export interface GeneratedChartSpec {
  title: string;
  chartType: "bar" | "line" | "area" | "scatter" | "table";
  x: string;
  y: string;
  xBinding?: ChartFieldBinding;
  yBinding?: ChartFieldBinding;
  filters: Array<{ field: string; operator: "eq" | "in" | "between"; values: string[] }>;
  rationale?: string;
}

const CHART_TYPES = ["bar", "line", "area", "scatter", "table"] as const;
const AGGREGATIONS = ["sum", "average", "count", "min", "max", "none"] as const;

function parseBinding(value: unknown): ChartFieldBinding | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rec = value as Record<string, unknown>;
  const table = typeof rec.table === "string" ? rec.table : "";
  const field = typeof rec.field === "string" ? rec.field : "";
  if (!table || !field) return undefined;
  const agg = AGGREGATIONS.includes(rec.aggregation as (typeof AGGREGATIONS)[number])
    ? (rec.aggregation as ChartFieldBinding["aggregation"])
    : undefined;
  return {
    table,
    field,
    isMeasure: rec.isMeasure === true,
    ...(agg ? { aggregation: agg } : {}),
  };
}

export async function generateChartSpec(input: ChartSpecInput): Promise<GeneratedChartSpec> {
  const anthropic = new Anthropic({ apiKey: input.apiKey });
  const hasSchema = input.schema.tables.length > 0;
  const schemaText = hasSchema
    ? input.schema.tables
        .slice(0, 50)
        .map((t) => `${t.name}(${t.columns.slice(0, 30).map((c) => `${c.name}:${c.dataType}`).join(", ")})`)
        .join("\n")
    : "(schema unavailable — infer reasonable field names from the prompt)";
  const measuresText = input.schema.measures.slice(0, 60).map((m) => `[${m.name}]`).join(", ");

  const response = await anthropic.messages.create({
    model: input.model,
    max_tokens: 700,
    temperature: 0,
    system:
      "You are a Power BI visualization designer. Given a natural-language request and the dataset schema, " +
      "choose the best chart and field mapping. Output ONLY a JSON object — no prose, no markdown fences — with keys: " +
      `title (string), chartType (one of ${CHART_TYPES.join("|")}), x (string field/column name for display), ` +
      "y (string field/measure for display), " +
      "xBinding ({table, field, isMeasure: bool, aggregation: sum|average|count|min|max|none}), " +
      "yBinding (same shape as xBinding), " +
      "filters (array of {field, operator: eq|in|between, values: string[]}), rationale (one short sentence). " +
      "For xBinding/yBinding: 'table' is the owning table name, 'field' is the column or measure name, " +
      "'isMeasure' is true only for a model measure, and 'aggregation' is the aggregation to apply to a numeric column " +
      "(use 'none' for categorical/date columns and for explicit measures). The x axis is usually a date/category " +
      "column (aggregation 'none'); the y axis is usually a numeric measure (e.g. sum of an amount column). " +
      "Visualization best practices: use 'line' or 'area' for trends over time, 'bar' for comparisons across categories, " +
      "'scatter' for correlation between two measures, 'table' for detailed lookups. " +
      (hasSchema
        ? "Every table/field in x, y, xBinding, yBinding, and filters MUST exist in the schema."
        : "No schema is available; infer plausible names and leave xBinding/yBinding null."),
    messages: [
      {
        role: "user",
        content:
          (input.reportName ? `Report: "${input.reportName}"\n\n` : "") +
          `Schema:\n${schemaText}\n\n` +
          (measuresText ? `Measures: ${measuresText}\n\n` : "") +
          `Request: ${input.prompt}\n\nReturn the JSON chart specification.`,
      },
    ],
  });

  const first = response.content[0];
  if (!first || first.type !== "text") throw new Error("Chart generation produced no output");
  const obj = parseJsonObject(first.text);

  const chartType = CHART_TYPES.includes(obj.chartType as (typeof CHART_TYPES)[number])
    ? (obj.chartType as GeneratedChartSpec["chartType"])
    : "bar";
  const rawFilters = Array.isArray(obj.filters) ? obj.filters : [];
  const filters: GeneratedChartSpec["filters"] = rawFilters
    .map((f) => {
      const rec = f as Record<string, unknown>;
      const op = rec.operator === "in" || rec.operator === "between" ? rec.operator : "eq";
      return {
        field: typeof rec.field === "string" ? rec.field : "",
        operator: op as "eq" | "in" | "between",
        values: Array.isArray(rec.values) ? rec.values.map((v) => String(v)) : [],
      };
    })
    .filter((f) => f.field.length > 0);

  const xBinding = parseBinding(obj.xBinding);
  const yBinding = parseBinding(obj.yBinding);

  return {
    title: typeof obj.title === "string" && obj.title.trim() ? obj.title : "AI Suggested Visual",
    chartType,
    x: typeof obj.x === "string" ? obj.x : "",
    y: typeof obj.y === "string" ? obj.y : "",
    filters,
    ...(xBinding ? { xBinding } : {}),
    ...(yBinding ? { yBinding } : {}),
    ...(typeof obj.rationale === "string" ? { rationale: obj.rationale } : {}),
  };
}

export interface DataPrepInput {
  apiKey: string;
  model: string;
  datasetId: string;
  intent: string;
  schema: SchemaInput;
}

export interface GeneratedTransform {
  type: "trim" | "uppercase" | "lowercase" | "replace_null" | "deduplicate" | "filter_rows" | "cast_type";
  field: string;
  replacement?: string;
  detail?: string;
}

export interface GeneratedDataPrepPlan {
  transforms: GeneratedTransform[];
  summary: string;
}

const TRANSFORM_TYPES = ["trim", "uppercase", "lowercase", "replace_null", "deduplicate", "filter_rows", "cast_type"] as const;

export async function generateDataPrepPlan(input: DataPrepInput): Promise<GeneratedDataPrepPlan> {
  const anthropic = new Anthropic({ apiKey: input.apiKey });
  const hasSchema = input.schema.tables.length > 0;
  const schemaText = hasSchema
    ? input.schema.tables
        .slice(0, 50)
        .map((t) => `${t.name}(${t.columns.slice(0, 30).map((c) => `${c.name}:${c.dataType}`).join(", ")})`)
        .join("\n")
    : "(schema unavailable — infer reasonable field names from the intent)";

  const response = await anthropic.messages.create({
    model: input.model,
    max_tokens: 800,
    temperature: 0,
    system:
      "You are a data-preparation planner for governed Power BI datasets. Given an intent and the dataset schema, " +
      "produce a safe, ordered transformation plan. Output ONLY a JSON object — no prose, no markdown fences — with keys: " +
      `transforms (array of {type: one of ${TRANSFORM_TYPES.join("|")}, field: string, replacement?: string, detail?: short string}), ` +
      "summary (one or two sentences describing the plan). " +
      "Data-prep best practices: prefer non-destructive steps; trim and standardize text before deduplicating; " +
      "replace nulls with explicit defaults rather than dropping rows; only cast types when the intent requires it; " +
      "keep the plan minimal — do not invent steps the intent does not justify. " +
      (hasSchema
        ? "Every 'field' MUST be a real column from the schema."
        : "No schema is available; infer plausible column names from the intent."),
    messages: [
      {
        role: "user",
        content:
          `Dataset: ${input.datasetId}\n\nSchema:\n${schemaText}\n\nIntent: ${input.intent}\n\nReturn the JSON transformation plan.`,
      },
    ],
  });

  const first = response.content[0];
  if (!first || first.type !== "text") throw new Error("Data-prep generation produced no output");
  const obj = parseJsonObject(first.text);

  const rawTransforms = Array.isArray(obj.transforms) ? obj.transforms : [];
  const transforms: GeneratedTransform[] = rawTransforms
    .map((t) => {
      const rec = t as Record<string, unknown>;
      const type = TRANSFORM_TYPES.includes(rec.type as (typeof TRANSFORM_TYPES)[number])
        ? (rec.type as GeneratedTransform["type"])
        : "trim";
      return {
        type,
        field: typeof rec.field === "string" ? rec.field : "",
        ...(typeof rec.replacement === "string" ? { replacement: rec.replacement } : {}),
        ...(typeof rec.detail === "string" ? { detail: rec.detail } : {}),
      };
    })
    .filter((t) => t.field.length > 0);

  return {
    transforms,
    summary: typeof obj.summary === "string" && obj.summary.trim()
      ? obj.summary
      : `Prepared ${transforms.length} transform(s) for dataset ${input.datasetId}.`,
  };
}
