import { describe, expect, it } from "vitest";

import { meFor, mockUuid } from "./store";

describe("mock store: me", () => {
  it("uses the contract's UUID scheme for fixture slugs", () => {
    expect(mockUuid("package", "pkg_1042")).toBe("0193a000-0000-7000-8002-000000001042");
    expect(mockUuid("user", "u1")).toBe("0193a000-0000-7000-8000-000000000001");
    expect(mockUuid("customer", "c2")).toBe("0193a000-0000-7000-8001-000000000002");
  });

  it("gives the approver the approve permission and the company", () => {
    expect(meFor("u2")).toMatchObject({
      full_name: "Rəşad Əliyev",
      role: "approver",
      company: { name: "A Distribusiya MMC", voen: "1700123451" },
    });
    expect(meFor("u2")?.permissions).toContain("APPROVE_PACKAGE");
  });

  it("never lets an operator or auditor approve", () => {
    expect(meFor("u1")?.permissions).not.toContain("APPROVE_PACKAGE");
    expect(meFor("u5")?.permissions).toEqual(["VIEW"]);
  });

  it("has no session for users who cannot sign in", () => {
    expect(meFor("u3")).toBeUndefined();
    expect(meFor("nobody")).toBeUndefined();
  });
});
