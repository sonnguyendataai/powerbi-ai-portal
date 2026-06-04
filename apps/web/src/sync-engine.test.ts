import { describe, expect, it, vi } from "vitest";
import { BiOperationsService, createBiOpsStore } from "@portal/bi-operations";
import { runPowerBiContentSync } from "./sync-engine";

vi.mock("./powerbi-content-client", () => ({
  fetchPowerBiContent: vi.fn(async () => [
    {
      workspaceId: "ws-main",
      workspaceName: "Main Workspace",
      datasets: [{ id: "dataset-sales", name: "Sales Model" }],
      reports: [
        {
          id: "report-sales",
          name: "Sales Overview",
          datasetId: "dataset-sales",
          embedUrl: "https://app.powerbi.com/reportEmbed?reportId=report-sales",
        },
      ],
      pagesByReportId: {
        "report-sales": [{ id: "report-sales:Main", name: "Main", displayName: "Main", order: 0 }],
      },
    },
  ]),
  hashContent: (input: unknown) => JSON.stringify(input).length.toString(),
}));

describe("runPowerBiContentSync", () => {
  it("creates sync run and stores delta details", async () => {
    const service = new BiOperationsService(createBiOpsStore());
    const result = await runPowerBiContentSync(service, {
      mode: "full",
      dryRun: true,
      triggeredBy: "test",
    });

    const run = service.getSyncRun(result.runId);
    expect(run).toBeDefined();
    expect(run?.status).toBe("succeeded");
    expect(service.listSyncDeltaItems(result.runId).length).toBeGreaterThanOrEqual(1);
  });
});
