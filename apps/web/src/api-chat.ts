import { answerDataQuestion, type ReportContext } from "./agent-api";
import { emitTelemetry } from "./telemetry";
import type { SessionUser } from "./auth";

export async function postChat(
  user: SessionUser,
  message: string,
  reportContext?: ReportContext,
): Promise<{
  answer: string;
  evidence: string[];
  usedTools: string[];
}> {
  const started = Date.now();
  const result = await answerDataQuestion(user, message, reportContext);
  emitTelemetry({
    name: "chat.completed",
    tenantId: user.tenantId,
    userId: user.userId,
    durationMs: Date.now() - started,
    metadata: { usedTools: result.usedTools },
  });
  return result;
}
