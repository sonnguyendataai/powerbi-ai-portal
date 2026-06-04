import Anthropic from "@anthropic-ai/sdk";

export interface AnthropicAnswerInput {
  apiKey: string;
  model: string;
  tenantId: string;
  question: string;
  intent: string;
  evidence: string[];
}

export async function generateAnthropicAnswer(input: AnthropicAnswerInput): Promise<string> {
  const anthropic = new Anthropic({ apiKey: input.apiKey });
  const evidenceText = input.evidence.map((e, i) => `${i + 1}. ${e}`).join("\n");
  const response = await anthropic.messages.create({
    model: input.model,
    max_tokens: 600,
    temperature: 0.2,
    system:
      "You are an enterprise BI analyst assistant. Be concise and factual. " +
      "Use only provided evidence and never invent metrics. Mention limitations clearly.",
    messages: [
      {
        role: "user",
        content:
          `Tenant: ${input.tenantId}\nIntent: ${input.intent}\n` +
          `Question: ${input.question}\n\nEvidence:\n${evidenceText}\n\n` +
          "Write a direct answer in plain English with 2-4 bullet insights.",
      },
    ],
  });

  const first = response.content[0];
  if (!first || first.type !== "text") {
    return "Unable to generate answer from Anthropic response.";
  }
  return first.text.trim();
}
