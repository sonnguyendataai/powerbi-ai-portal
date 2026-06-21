import { generateChartSpec, type ChartContext, type ChartSpec } from "./chart-studio";
import { emitTelemetry } from "./telemetry";
import type { SessionUser } from "./auth";

export async function postChartPrompt(
  user: SessionUser,
  prompt: string,
  context?: ChartContext,
  create = false,
): Promise<ChartSpec> {
  const spec = await generateChartSpec(user, prompt, context, create);
  emitTelemetry({
    name: spec.createdReport ? "chart.report_created" : "chart.spec_generated",
    tenantId: user.tenantId,
    userId: user.userId,
    metadata: { chartType: spec.chartType, created: !!spec.createdReport },
  });
  return spec;
}
