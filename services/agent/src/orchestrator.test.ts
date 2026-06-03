import { describe, expect, it } from "vitest";
import { buildOrchestrationPlan } from "./orchestrator";

describe("buildOrchestrationPlan", () => {
  it("classifies trend intent", () => {
    const plan = buildOrchestrationPlan({
      tenantId: "t1",
      userId: "u1",
      roles: ["analyst"],
      question: "Show revenue trend by month",
    });
    expect(plan.intent).toBe("trend");
    expect(plan.toolSequence.length).toBeGreaterThan(0);
  });
});
