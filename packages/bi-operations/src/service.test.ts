import { describe, expect, it } from "vitest";
import { BiOperationsService } from "./service";

describe("BiOperationsService", () => {
  it("starts empty and exports records after upsert", () => {
    const svc = new BiOperationsService();
    expect(svc.listUsers().length).toBe(0);
    svc.upsertUser({
      id: "user-seed",
      email: "seed@tenant.local",
      tenantId: "tenant-default",
      roleIds: [],
      customFields: {},
    });
    expect(svc.listUsers().length).toBe(1);
    expect(svc.exportUsers().length).toBe(1);
  });

  it("assigns permission and resolves reports for user", () => {
    const svc = new BiOperationsService();
    svc.upsertReport({
      id: "report-real",
      workspaceId: "ws-real",
      datasetId: "ds-real",
      name: "Real Report",
      displayName: "Real Report",
      embedUrl: "https://app.powerbi.com/reportEmbed?reportId=real",
      pageIds: [],
      isDeleted: false,
    });
    svc.upsertUser({
      id: "user-1",
      email: "u1@tenant.local",
      tenantId: "tenant-default",
      roleIds: [],
      customFields: {},
    });
    svc.assignPermission({ userId: "user-1", reportId: "report-real" });
    expect(svc.listReportsForUser("user-1").map((r) => r.id)).toContain("report-real");
  });

  it("emits snapshot on mutation", () => {
    const snapshots: number[] = [];
    const svc = new BiOperationsService(undefined, {
      onMutate: (snapshot) => snapshots.push(snapshot.users.length),
    });
    svc.upsertUser({
      id: "user-2",
      email: "u2@tenant.local",
      tenantId: "tenant-default",
      roleIds: ["role-member"],
      customFields: {},
    });
    expect(snapshots.length).toBe(1);
  });

  it("tracks sync runs and delta items", () => {
    const svc = new BiOperationsService();
    const run = svc.startSyncRun({
      mode: "full",
      dryRun: true,
      triggeredBy: "test",
    });
    svc.appendSyncDeltaItems(run.id, [
      {
        runId: run.id,
        entityType: "report",
        entityId: "report-1",
        changeType: "added",
      },
      {
        runId: run.id,
        entityType: "page",
        entityId: "page-1",
        changeType: "updated",
      },
    ]);
    const finished = svc.finishSyncRun(run.id, { status: "succeeded" });
    expect(finished?.status).toBe("succeeded");
    expect(finished?.summaryCounts).toEqual({ added: 1, updated: 1, removed: 0 });
    expect(svc.listSyncDeltaItems(run.id)).toHaveLength(2);
  });
});
