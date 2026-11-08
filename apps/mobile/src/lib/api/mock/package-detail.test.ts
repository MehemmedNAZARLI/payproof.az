import packages from "@fixtures/packages.json";
import { describe, expect, it } from "vitest";

import { contractErrors } from "@/test/contract";

import { packageDetail } from "./package-detail";
import { mockUuid } from "./store";

const idOf = (invoice: string) =>
  mockUuid("package", packages.find((p) => p.invoice_number === invoice)!.id);
const detail = (invoice: string, user = "u2") => packageDetail(idOf(invoice), user)!;

describe("mock package detail", () => {
  it.each(packages.map((p) => [p.invoice_number] as const))(
    "%s conforms to the PackageDetail contract",
    (invoice) => {
      expect(contractErrors("PackageDetail", detail(invoice))).toEqual([]);
    },
  );

  it("matches the contract example for INV-1042", () => {
    const d = detail("INV-1042", "u1");
    expect(d.documents[0]!.current.id).toBe("0193a000-0000-7000-8005-000010420001");
    expect(d.requirement_set.id).toBe("0193a000-0000-7000-800d-000000000102");
    expect(d.link.candidates[0]).toMatchObject({
      order_id: "0193a000-0000-7000-8003-000000000381",
      total: { amount: "12000.00", currency: "AZN" },
    });
    expect(d.summary).toMatchObject({ pass: 1, fail: 2, unknown: 5, not_applicable: 1 });
    expect(d.checks[0]!.evidence[0]).toEqual({
      document_version_id: d.documents[0]!.current.id,
      page: 1,
      quote: "Sifariş №: —",
      bbox: null,
    });
  });

  it("has a current approval only when it covers this version and rule set", () => {
    expect(detail("INV-1035").current_approval).toMatchObject({ valid: true });
    const invalidated = detail("INV-1036");
    expect(invalidated.current_approval).toBeNull();
    expect(invalidated.approvals[0]).toMatchObject({ valid: false, package_version: 2 });
  });

  it("hands the approve permission only to an approver of a ready package", () => {
    expect(detail("INV-1038", "u2").permissions.can_approve).toBe(true);
    expect(detail("INV-1038", "u1").permissions.can_approve).toBe(false);
  });

  it("has no checks and no invoice data while processing", () => {
    const d = detail("INV-1050");
    expect(d).toMatchObject({ processing: true, invoice_number: null, checks: [], total: null });
  });

  it("returns nothing for an unknown package or a user who cannot sign in", () => {
    expect(packageDetail(mockUuid("package", "pkg_9999"), "u2")).toBeUndefined();
    expect(packageDetail(idOf("INV-1038"), "u3")).toBeUndefined();
  });
});
