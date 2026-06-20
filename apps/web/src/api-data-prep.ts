import { buildDataPrepPlan, type DataPrepContext } from "./data-prep";
import { emitTelemetry } from "./telemetry";
import type { SessionUser } from "./auth";

export async function postDataPrep(
  user: SessionUser,
  payload: { datasetId: string; intent: string; workspaceId?: string | undefined },
) {
  const context: DataPrepContext = payload.workspaceId ? { workspaceId: payload.workspaceId } : {};
  const plan = await buildDataPrepPlan(user, payload.datasetId, payload.intent, context);
  emitTelemetry({
    name: "dataprep.plan_generated",
    tenantId: user.tenantId,
    userId: user.userId,
    metadata: { datasetId: payload.datasetId, transformCount: plan.transforms.length },
  });
  return plan;
}
