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
    system:
      "You are an enterprise BI analyst assistant embedded in a Power BI portal. " +
      "Be concise and factual. Use only the provided evidence — never invent numbers or metrics. " +
      "When dataset schema is available, reference specific table and column names in your answer. " +
      "Mention limitations clearly if evidence is incomplete.",
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
