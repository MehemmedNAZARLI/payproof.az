import { describe, expect, it } from "vitest";

import { loginHref, safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("returns to an in-app path with its query", () => {
    expect(safeNextPath("/packages?status=ready")).toBe("/packages?status=ready");
  });

  it("falls back to home for missing, foreign or looping targets", () => {
    for (const raw of [
      null,
      "",
      "packages",
      "//evil.test/x",
      "/\\evil.test",
      "/.//evil.test",
      "/%2e//evil.test",
      "/a/..//evil.test",
      "/./\\evil.test",
      "https://evil.test/",
      "javascript:alert(1)",
      "/login",
      "/login?next=/home",
    ])
      expect(safeNextPath(raw)).toBe("/home");
  });
});

describe("loginHref", () => {
  it("carries the current page, but not home itself", () => {
    expect(loginHref("/packages", "?status=ready")).toBe(
      "/login?next=%2Fpackages%3Fstatus%3Dready",
    );
    expect(loginHref("/home", "")).toBe("/login");
  });
});
