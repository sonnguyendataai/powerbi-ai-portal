import { PolicyEngine, emitAudit } from "@portal/agent-core";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";

export interface ChartSpec {
  title: string;
  chartType: "bar" | "line" | "area" | "scatter" | "table";
  x: string;
  y: string;
  filters: Array<{ field: string; operator: "eq" | "in" | "between"; values: string[] }>;
}

export function generateChartSpec(user: SessionUser, prompt: string): ChartSpec {
  const policy = new PolicyEngine();
  const decision = policy.evaluate({
    subject: { userId: user.userId, tenantId: user.tenantId, roles: user.roles },
    action: "generate_chart",
    resource: buildResource(user.tenantId, "chart", "studio"),
  });
  if (!decision.allowed) throw new Error(decision.reason ?? "chart generation denied");

  const lowered = prompt.toLowerCase();
  const chartType: ChartSpec["chartType"] = lowered.includes("trend") ? "line" : "bar";
  emitAudit({
    kind: "chart.generated",
    userId: user.userId,
    tenantId: user.tenantId,
    metadata: { chartType, promptLength: prompt.length },
  });
  return {
    title: "AI Suggested Visual",
    chartType,
    x: "Date",
    y: "Revenue",
    filters: [],
  };
}
