import { describe, expect, it } from "vitest";
import { generateChartSpec } from "./chart-studio";

describe("generateChartSpec", () => {
  it("returns line chart for trend prompt", () => {
    const spec = generateChartSpec(
      { userId: "u1", tenantId: "t1", roles: ["analyst"] },
      "trend revenue in last 12 months",
    );
    expect(spec.chartType).toBe("line");
  });
});
