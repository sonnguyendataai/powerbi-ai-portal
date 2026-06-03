import { describe, expect, it } from "vitest";
import { buildDataPrepPlan } from "./data-prep";

describe("buildDataPrepPlan", () => {
  it("creates transform plan for analyst", () => {
    const plan = buildDataPrepPlan(
      { userId: "u1", tenantId: "t1", roles: ["analyst"] },
      "sales-ds",
      "clean this dataset",
    );
    expect(plan.transforms.length).toBeGreaterThan(0);
  });
});
