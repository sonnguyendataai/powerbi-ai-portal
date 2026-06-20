import { generateChartSpec, type ChartContext, type ChartSpec } from "./chart-studio";
import { emitTelemetry } from "./telemetry";
import type { SessionUser } from "./auth";

export async function postChartPrompt(
  user: SessionUser,
  prompt: string,
  context?: ChartContext,
): Promise<ChartSpec> {
  const spec = await generateChartSpec(user, prompt, context);
  emitTelemetry({
    name: "chart.spec_generated",
    tenantId: user.tenantId,
    userId: user.userId,
    metadata: { chartType: spec.chartType },
  });
  return spec;
}
