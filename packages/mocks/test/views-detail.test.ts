import { describe, expect, it } from "vitest";
import { createDemoDb } from "../src/domain/seed";
import { packageDetail } from "../src/views/detail";
import { assertSchema } from "./contract";

describe("package detail", () => {
  const db = createDemoDb();

  it("conforms to PackageDetail for every package and demo user", () => {
    for (const viewer of ["u1", "u2", "u5"])
      for (const p of db.packages) assertSchema("PackageDetail", packageDetail(db, p, viewer));
  });

  it("INV-1042 initial: link candidates, summary and blockers", () => {
    const d = packageDetail(db, db.pkg("pkg_1042"), "u1");
    expect(d).toMatchObject({
      version: 1,
      status: "NEEDS_REVIEW",
      requirement_set: { version: 2, require_signature: true },
      link: {
        confirmed: false,
        order_id: null,
        candidates: [{ po_number: "PO-381", total: { amount: "12000.00" } }],
      },
      summary: { pass: 1, fail: 2, unknown: 5, not_applicable: 1 },
      current_approval: null,
    });
    expect(d.checks).toHaveLength(9);
  });

  it("permissions are role AND state: only the approver may approve a ready package", () => {
    const p = db.pkg("pkg_1038");
    expect(packageDetail(db, p, "u2").permissions).toMatchObject({
      can_approve: true,
      can_delete: false,
    });
    expect(packageDetail(db, p, "u1").permissions).toMatchObject({
      can_approve: false,
      can_export: false,
    });
    expect(packageDetail(db, db.pkg("pkg_1042"), "u2").permissions.can_approve).toBe(false);
    expect(packageDetail(db, db.pkg("pkg_1035"), "u1").permissions.can_export).toBe(true);
    expect(Object.values(packageDetail(db, p, "u5").permissions).some(Boolean)).toBe(false);
  });

  it("INV-1036 keeps the invalidated v2 approval in history but has no current approval", () => {
    const d = packageDetail(db, db.pkg("pkg_1036"), "u2");
    expect(d.current_approval).toBeNull();
    expect(d.approvals).toMatchObject([{ package_version: 2, valid: false }]);
  });
});
