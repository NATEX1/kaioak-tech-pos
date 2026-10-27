import { describe, expect, it } from "vitest";

import { safeInternalPath } from "@/lib/safe-redirect";

describe("safeInternalPath", () => {
  it("allows same-site paths with query and hash", () => {
    expect(safeInternalPath("/settings/users?page=2#top")).toBe(
      "/settings/users?page=2#top",
    );
  });

  it.each([
    "https://evil.example",
    "//evil.example/path",
    "/\\evil.example",
    "javascript:alert(1)",
    "/login",
    "",
  ])("falls back for unsafe value %s", (value) => {
    expect(safeInternalPath(value)).toBe("/");
  });

  it("uses a custom fallback", () => {
    expect(safeInternalPath(undefined, "/profile")).toBe("/profile");
  });
});
