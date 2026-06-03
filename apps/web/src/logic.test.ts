import { describe, expect, it } from "vitest";
import { postChartPrompt } from "./api-chart";
import { postDataPrep } from "./api-data-prep";
import type { SessionUser } from "./auth";

const user: SessionUser = { userId: "u1", tenantId: "t1", roles: ["analyst"] };

describe("web logic", () => {
  it("generates chart spec", () => {
    const chart = postChartPrompt(user, "show trend of revenue");
    expect(chart.chartType).toBe("line");
  });

  it("creates data prep plan", () => {
    const plan = postDataPrep(user, { datasetId: "sales", intent: "clean the data" });
    expect(plan.transforms.length).toBeGreaterThan(0);
  });
});
