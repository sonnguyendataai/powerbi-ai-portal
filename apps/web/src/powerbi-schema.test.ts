import { describe, expect, it } from "vitest";
import { extractPbiErrorMessage, type PbiQueryError } from "./powerbi-schema";

describe("extractPbiErrorMessage", () => {
  it("reads the human-readable detail from the 'pbi.error' envelope (dot, not underscore)", () => {
    // This is the exact shape Power BI executeQueries returns for a bad column.
    const err: PbiQueryError = {
      code: "DatasetExecuteQueriesError",
      "pbi.error": {
        code: "DatasetExecuteQueriesError",
        details: [
          { code: "DetailsMessage", detail: { type: 1, value: "Column 'Revenue' cannot be found or may not be used in this expression." } },
        ],
      },
    };
    const msg = extractPbiErrorMessage(err);
    expect(msg).toContain("Column 'Revenue' cannot be found");
    // The generic code is preserved as a suffix for API-gate vs DAX-error triage.
    expect(msg).toContain("DatasetExecuteQueriesError");
  });

  it("picks the longest detail value when several are present", () => {
    const err: PbiQueryError = {
      code: "DatasetExecuteQueriesError",
      "pbi.error": {
        details: [
          { detail: { value: "Short" } },
          { detail: { value: "A much longer and more useful diagnostic message about the failing table." } },
        ],
      },
    };
    expect(extractPbiErrorMessage(err)).toContain("more useful diagnostic message");
  });

  it("falls back to message, then code, then HTTP status", () => {
    expect(extractPbiErrorMessage({ message: "boom" })).toBe("boom");
    expect(extractPbiErrorMessage({ code: "OnlyCode" })).toBe("OnlyCode");
    expect(extractPbiErrorMessage(undefined, 403)).toBe("HTTP 403");
    expect(extractPbiErrorMessage(undefined)).toBe("unknown error");
  });
});
