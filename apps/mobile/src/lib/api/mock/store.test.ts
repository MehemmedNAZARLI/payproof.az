import expected from "@fixtures/expected.json";
import { describe, expect, it } from "vitest";

import { meFor, mockUuid, packageList } from "./store";

describe("mock store: packages", () => {
  it("has the 14 demo packages", () => {
    expect(packageList).toHaveLength(14);
  });

  it("derives every status and blocker list exactly as expected.json", () => {
    for (const [invoice, want] of Object.entries(expected.packages)) {
      const item = packageList.find((p) => p.id === mockUuid("package", want.package_id));
      expect(item, invoice).toMatchObject({
        status: want.status,
        version: want.version,
        blocking: want.blockers,
      });
    }
  });

  it("uses the contract's UUID scheme for fixture slugs", () => {
    expect(mockUuid("package", "pkg_1042")).toBe("0193a000-0000-7000-8002-000000001042");
    expect(mockUuid("user", "u1")).toBe("0193a000-0000-7000-8000-000000000001");
    expect(mockUuid("customer", "c2")).toBe("0193a000-0000-7000-8001-000000000002");
  });

  it("matches the contract example for INV-1042", () => {
    const item = packageList.find((p) => p.invoice_number === "INV-1042");
    expect(item).toMatchObject({
      total: { amount: "12000.00", currency: "AZN" },
      invoice_date: "2026-11-03",
      po_ref: null,
      po_unreadable: false,
      customer: { id: mockUuid("customer", "c1"), name: "B Mağazalar Şəbəkəsi" },
      owner: { id: mockUuid("user", "u1"), full_name: "Aygün Məmmədova", role: "operator" },
      problem_since: "2026-11-03T05:12:00Z",
    });
  });

  it("hides not-yet-extracted fields while processing", () => {
    const item = packageList.find((p) => p.status === "PROCESSING");
    expect(item).toMatchObject({
      invoice_number: null,
      invoice_date: null,
      total: null,
      po_ref: null,
    });
  });

  it("flags an unreadable PO", () => {
    expect(packageList.find((p) => p.invoice_number === "INV-1047")?.po_unreadable).toBe(true);
  });

  it("sets problem_since only for packages that need work, and UTC timestamps everywhere", () => {
    for (const p of packageList) {
      const open = p.status === "NEEDS_FIX" || p.status === "NEEDS_REVIEW";
      expect(p.problem_since !== null).toBe(open);
      expect(p.updated_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
      if (p.problem_since) expect(p.updated_at >= p.problem_since).toBe(true);
    }
  });
});

describe("mock store: me", () => {
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
