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
  schema: { tables: Array<{ name: string; columns: Array<{ name: string; dataType: string }> }>; measures: Array<{ name: string; expression: string }> };
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
          "Answer in plain English with 2–4 concise bullet insights. " +
          "If the question asks for analysis of this specific report, focus on it.",
      },
    ],
  });

  const first = response.content[0];
  if (!first || first.type !== "text") return "Unable to generate answer.";
  return first.text.trim();
}

export async function generateDaxQuery(input: DaxQueryInput): Promise<string> {
  const anthropic = new Anthropic({ apiKey: input.apiKey });

  const tablesSummary = input.schema.tables
    .slice(0, 10)
    .map((t) => `${t.name}(${t.columns.slice(0, 8).map((c) => `${c.name}:${c.dataType}`).join(", ")})`)
    .join("\n");
  const measuresSummary = input.schema.measures
    .slice(0, 15)
    .map((m) => `[${m.name}]`)
    .join(", ");

  const response = await anthropic.messages.create({
    model: input.model,
    max_tokens: 400,
    temperature: 0,
    system:
      "You are a DAX query generator. Output ONLY a valid DAX query starting with EVALUATE. " +
      "No explanation, no markdown fences, no comments. " +
      "Rules: use TOPN to limit rows (max 50); use SUMMARIZECOLUMNS for aggregations; " +
      "use DIVIDE not / for division; filter columns not tables inside CALCULATETABLE/FILTER; " +
      "every referenced table and column must exist in the schema provided.",
    messages: [
      {
        role: "user",
        content:
          `Tables:\n${tablesSummary}\n\n` +
          `Measures: ${measuresSummary || "none"}\n\n` +
          `Question: ${input.question}\n\n` +
          "Write a DAX query to answer this question. Return only the EVALUATE statement.",
      },
    ],
  });

  const first = response.content[0];
  if (!first || first.type !== "text") throw new Error("DAX generation produced no output");
  const text = first.text.trim();
  if (!text.toUpperCase().startsWith("EVALUATE")) throw new Error(`Generated text is not a DAX query: ${text.slice(0, 80)}`);
  return text;
}
