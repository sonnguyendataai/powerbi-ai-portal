import { PolicyEngine, emitAudit } from "@portal/agent-core";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";

export interface TransformInstruction {
  type: "trim" | "uppercase" | "replace_null";
  field: string;
  replacement?: string;
}

export interface DataPrepPlan {
  datasetId: string;
  transforms: TransformInstruction[];
  summary: string;
}

export function buildDataPrepPlan(
  user: SessionUser,
  datasetId: string,
  intent: string,
): DataPrepPlan {
  const policy = new PolicyEngine();
  const decision = policy.evaluate({
    subject: { userId: user.userId, tenantId: user.tenantId, roles: user.roles },
    action: "transform_data",
    resource: buildResource(user.tenantId, "dataset", datasetId),
  });
  if (!decision.allowed) throw new Error(decision.reason ?? "transform denied");

  const transforms: TransformInstruction[] = [];
  if (intent.toLowerCase().includes("clean")) {
    transforms.push({ type: "trim", field: "CustomerName" });
    transforms.push({ type: "replace_null", field: "Segment", replacement: "Unknown" });
  } else {
    transforms.push({ type: "uppercase", field: "Region" });
  }

  emitAudit({
    kind: "dataprep.plan_created",
    tenantId: user.tenantId,
    userId: user.userId,
    metadata: { datasetId, transformCount: transforms.length },
  });

  return {
    datasetId,
    transforms,
    summary: `Prepared ${transforms.length} business-safe transforms for dataset ${datasetId}.`,
  };
}
