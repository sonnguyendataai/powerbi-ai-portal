import { generateChartSpec, type ChartSpec } from "./chart-studio";
import { emitTelemetry } from "./telemetry";
import type { SessionUser } from "./auth";

export function postChartPrompt(user: SessionUser, prompt: string): ChartSpec {
  const spec = generateChartSpec(user, prompt);
  emitTelemetry({
    name: "chart.spec_generated",
    tenantId: user.tenantId,
    userId: user.userId,
    metadata: { chartType: spec.chartType },
  });
  return spec;
}
