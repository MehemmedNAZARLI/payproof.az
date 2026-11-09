import { describe, expect, it } from "vitest";
import { confirmLink, correctField } from "../src/domain/review";
import { info } from "../src/engine/status";
import { createMockDb } from "../src/store";

describe("review actions", () => {
  it("confirming the order link bumps the version and re-validates (INV-1042 → NEEDS_FIX v2)", () => {
    const db = createMockDb();
    const p = db.pkg("pkg_1042");
    expect(confirmLink(db, p, "PO-381", "u1")).toBe(true);
    expect(p).toMatchObject({
      version: 2,
      order_link: { confirmed: true, method: "human", confirmed_by: "u1" },
    });
    expect(info(db, p).status).toBe("NEEDS_FIX");
    expect(confirmLink(db, p, "PO-381", "u1")).toBe(false);
    expect(p.version).toBe(2);
  });

  it("a manual PO correction resolves the unreadable scan (INV-1047 → READY_FOR_APPROVAL)", () => {
    const db = createMockDb();
    const p = db.pkg("pkg_1047");
    correctField(db, p, "invoice.po_ref", "PO-397", "Skanda PO mənbəyə baxaraq təsdiqləndi", "u7");
    expect(info(db, p).status).toBe("READY_FOR_APPROVAL");
    expect(p.version).toBe(2);
    expect(p.corrections?.["invoice.po_ref"]).toMatchObject({
      from: "PO-3?7 (oxunmur)",
      to: "PO-397",
      by: "u7",
    });
  });

  it("rejects malformed corrected values", () => {
    const db = createMockDb();
    const p = db.pkg("pkg_1044");
    expect(() =>
      correctField(db, p, "invoice.lines[KY-10].unit_price", "100", "səbəb", "u1"),
    ).toThrow(/qiymət/i);
    expect(() => correctField(db, p, "invoice.lines[XX-1].qty", "5", "səbəb", "u1")).toThrow();
    expect(p.version).toBe(1);
  });
});
