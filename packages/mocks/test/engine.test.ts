import { describe, expect, it } from "vitest";
import expected from "../../../fixtures/expected.json";
import { evaluate } from "../src/engine";
import { createMockDb } from "../src/store";

const IMPLEMENTED = [
  "R-001",
  "R-002",
  "R-003",
  "R-004",
  "R-005",
  "R-006",
  "R-007",
  "R-008",
  "R-009",
];
const cases = Object.entries(expected.packages).filter(([, e]) => e.status !== "PROCESSING");

describe("mock rule engine = prototype engine (fixtures/expected.json)", () => {
  it.each(cases)("%s rule outcomes", (_inv, e) => {
    const db = createMockDb();
    const got = Object.fromEntries(
      evaluate(db, db.pkg(e.package_id)).map((c) => [c.rule_id, c.outcome]),
    );
    const want = Object.fromEntries(
      Object.entries(e.checks).filter(([r]) => IMPLEMENTED.includes(r)),
    );
    expect(got).toMatchObject(want);
  });

  it("INV-1042 R-001: FAIL with the prototype message and an invoice quote", () => {
    const db = createMockDb();
    const r001 = evaluate(db, db.pkg("pkg_1042")).find((c) => c.rule_id === "R-001")!;
    expect(r001).toMatchObject({
      outcome: "FAIL",
      cascade: false,
      fix_hint: "upload_invoice",
      message:
        "Müştəri qaydası fakturada sifariş nömrəsi tələb edir, fakturada isə PO göstərilməyib.",
    });
    expect(r001.evidence).toEqual([{ doc: "invoice", hl: "po", quote: "Sifariş №: —" }]);
  });

  it("INV-1047 R-001: unreadable PO is UNKNOWN (never PASS) and cascades to R-002", () => {
    const db = createMockDb();
    const checks = evaluate(db, db.pkg("pkg_1047"));
    expect(checks.find((c) => c.rule_id === "R-001")).toMatchObject({
      outcome: "UNKNOWN",
      fix_hint: "edit_field",
    });
    expect(checks.find((c) => c.rule_id === "R-001")!.evidence[0]!.quote).toBe(
      "Sifariş №: PO-3?7 (oxunmur)",
    );
    expect(checks.find((c) => c.rule_id === "R-002")).toMatchObject({
      outcome: "UNKNOWN",
      cascade: true,
    });
  });

  it("INV-1046 R-003: a delivery note of another buyer FAILs", () => {
    const db = createMockDb();
    const r003 = evaluate(db, db.pkg("pkg_1046")).find((c) => c.rule_id === "R-003")!;
    expect(r003).toMatchObject({ outcome: "FAIL", fix_hint: "upload_delivery" });
    expect(r003.message).toContain("C Restoran Qrupu");
  });

  it("INV-1044 R-005: price difference 500.00 AZN in cents, prototype message", () => {
    const db = createMockDb();
    const r005 = evaluate(db, db.pkg("pkg_1044")).find((c) => c.rule_id === "R-005")!;
    expect(r005).toMatchObject({
      outcome: "FAIL",
      data: {
        line_difference: { amount: expected.packages["INV-1044"].r005_diff, currency: "AZN" },
      },
    });
    expect(r005.message).toBe(
      "KY-10: fakturada 110,00 AZN, sifarişdə 100,00 AZN × 50 = 500,00 AZN fərq. Aktual qiymət əlavəsini yoxlayın. Fərq itki və ya gəlir sayılmır.",
    );
  });

  it("INV-1045 R-006: delivered 100 vs invoiced 120 FAILs", () => {
    const db = createMockDb();
    const r006 = evaluate(db, db.pkg("pkg_1045")).find((c) => c.rule_id === "R-006")!;
    expect(r006.outcome).toBe("FAIL");
    expect(r006.message).toContain("MS-05: fakturada 120, təhvil aktında 100 qutu");
  });

  it("evaluates all nine rules, every result exactly once", () => {
    const db = createMockDb();
    expect(evaluate(db, db.pkg("pkg_1038")).map((c) => c.rule_id)).toEqual(IMPLEMENTED);
  });

  it("INV-1046 R-007: delivery note for another order is UNKNOWN, not PASS", () => {
    const db = createMockDb();
    const r007 = evaluate(db, db.pkg("pkg_1046")).find((c) => c.rule_id === "R-007")!;
    expect(r007.outcome).toBe("UNKNOWN");
    expect(r007.message).toBe(
      "TS-5529 sənədində sifariş: PO-391; təsdiqlənmiş sifariş: PO-386. Uyğunluq təsdiqlənməyib.",
    );
  });

  it("R-009 fails when the stated total differs beyond the tolerance", () => {
    const db = createMockDb();
    const p = db.pkg("pkg_1038");
    p.invoice.total = "4860.02";
    expect(evaluate(db, p).find((c) => c.rule_id === "R-009")).toMatchObject({ outcome: "FAIL" });
    p.invoice.total = "4860.01";
    expect(evaluate(db, p).find((c) => c.rule_id === "R-009")).toMatchObject({ outcome: "PASS" });
  });

  it("INV-1049 R-004: currency mismatch is UNKNOWN, no automatic conversion", () => {
    const db = createMockDb();
    const r004 = evaluate(db, db.pkg("pkg_1049")).find((c) => c.rule_id === "R-004")!;
    expect(r004.outcome).toBe("UNKNOWN");
    expect(r004.message).toContain("Faktura USD, sifariş AZN");
  });
});
