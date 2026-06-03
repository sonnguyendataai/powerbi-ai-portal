import { describe, expect, it } from "vitest";
import { PolicyEngine } from "./policy-engine";

describe("PolicyEngine", () => {
  const engine = new PolicyEngine();

  it("allows analyst chart generation within tenant scope", () => {
    const result = engine.evaluate({
      subject: { userId: "u1", tenantId: "t1", roles: ["analyst"] },
      action: "generate_chart",
      resource: "tenant:t1:chart:studio",
    });
    expect(result.allowed).toBe(true);
  });

  it("denies cross-tenant reads", () => {
    const result = engine.evaluate({
      subject: { userId: "u1", tenantId: "t1", roles: ["analyst"] },
      action: "read_data",
      resource: "tenant:t2:semantic-model:default",
    });
    expect(result.allowed).toBe(false);
  });
});
