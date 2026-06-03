import { describe, expect, it } from "vitest";
import { BiOperationsService } from "./service";

describe("BiOperationsService", () => {
  it("returns default users and exports records", () => {
    const svc = new BiOperationsService();
    expect(svc.listUsers().length).toBeGreaterThan(0);
    expect(svc.exportUsers().length).toBeGreaterThan(0);
  });

  it("assigns permission and resolves reports for user", () => {
    const svc = new BiOperationsService();
    svc.upsertUser({
      id: "user-1",
      email: "u1@tenant.local",
      tenantId: "tenant-default",
      roleIds: ["role-member"],
      customFields: {},
    });
    svc.assignPermission({ userId: "user-1", reportId: "report-sales" });
    expect(svc.listReportsForUser("user-1").map((r) => r.id)).toContain("report-sales");
  });
});
