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
        .slice(0, 10)
        .map((t) => `${t.name}(${t.columns.slice(0, 10).map((c) => `${c.name}:${c.dataType}`).join(", ")})`)
        .join("\n")
    : "(schema not available — infer from report name and question context)";
  const measuresSummary = input.schema.measures.slice(0, 20).map((m) => `[${m.name}]`).join(", ");

  const schemaInstruction = hasSchema
    ? "Every referenced table and column MUST exist exactly as listed in the schema above."
    : `No schema is available. Use your knowledge of Power BI HR/business datasets to infer likely table and column names from the report name "${input.reportName}". ` +
      "Common patterns: fact tables named after the domain (e.g. 'Employee', 'Headcount', 'Turnover'), " +
      "date dimension named 'Date' or 'Calendar' with a 'Year' column, " +
      "measure names matching the question topic. If you cannot produce a reliable query, " +
      "write a query that will surface an informative error rather than wrong data.";

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
