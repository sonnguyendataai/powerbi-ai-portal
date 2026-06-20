import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { postChartPrompt } from "./api-chart";
import { postDataPrep } from "./api-data-prep";
import type { SessionUser } from "./auth";

const user: SessionUser = { userId: "u1", tenantId: "t1", roles: ["analyst"] };

describe("web logic", () => {
  // These flows now call Anthropic; without an API key configured they must
  // fail loudly (no silent mock fallback) rather than return fabricated data.
  const original = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; });
  afterEach(() => { if (original !== undefined) process.env.ANTHROPIC_API_KEY = original; });

  it("chart generation requires Anthropic configuration", async () => {
    await expect(postChartPrompt(user, "show trend of revenue")).rejects.toThrow(/not configured|ANTHROPIC/i);
  });

  it("data prep planning requires Anthropic configuration", async () => {
    await expect(
      postDataPrep(user, { datasetId: "sales", intent: "clean the data" }),
    ).rejects.toThrow(/not configured|ANTHROPIC/i);
  });
});
