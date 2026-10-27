import { describe, expect, it } from "vitest";

import { buildPageUrl } from "@/components/ui/pagination";

describe("buildPageUrl", () => {
  it("returns base path for page 1 without extra params", () => {
    expect(buildPageUrl("/bills", 1)).toBe("/bills");
  });

  it("appends page parameter for page > 1", () => {
    expect(buildPageUrl("/bills", 2)).toBe("/bills?page=2");
    expect(buildPageUrl("/bills", 10)).toBe("/bills?page=10");
  });

  it("preserves additional search parameters", () => {
    const url = buildPageUrl("/bills", 3, {
      status: "APPROVED",
      q: "คอมพิวเตอร์",
    });
    expect(url).toContain("status=APPROVED");
    expect(url).toContain("page=3");
    expect(url).toContain("q=");
  });

  it("omits empty or undefined preserve parameters", () => {
    const url = buildPageUrl("/bills", 1, {
      status: "PAID",
      q: undefined,
      technicianId: "",
    });
    expect(url).toBe("/bills?status=PAID");
  });

  it("does not add page=1 when other parameters are present", () => {
    const url = buildPageUrl("/audit-logs", 1, {
      entityType: "Bill",
    });
    expect(url).toBe("/audit-logs?entityType=Bill");
  });
});
