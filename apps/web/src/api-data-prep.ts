import { buildDataPrepPlan } from "./data-prep";
import { emitTelemetry } from "./telemetry";
import type { SessionUser } from "./auth";

export function postDataPrep(
  user: SessionUser,
  payload: { datasetId: string; intent: string },
) {
  const plan = buildDataPrepPlan(user, payload.datasetId, payload.intent);
  emitTelemetry({
    name: "dataprep.plan_generated",
    tenantId: user.tenantId,
    userId: user.userId,
    metadata: { datasetId: payload.datasetId, transformCount: plan.transforms.length },
  });
  return plan;
}
