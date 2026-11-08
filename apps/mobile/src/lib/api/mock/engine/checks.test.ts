import expected from "@fixtures/expected.json";
import packages from "@fixtures/packages.json";
import { describe, expect, it } from "vitest";

import { runChecks } from "./checks";
import { packageModel } from "./model";

const evaluated = packages.filter((p) => !p.processing);
const golden = (invoice: string) => expected.packages[invoice as keyof typeof expected.packages];

describe("ported rule engine", () => {
  it.each(evaluated.map((p) => [p.invoice_number, p] as const))(
    "%s matches the golden outcomes and blockers",
    (invoice, p) => {
      const checks = runChecks(packageModel(p));
      const g = golden(invoice);
      expect(Object.fromEntries(checks.map((c) => [c.ruleId, c.outcome]))).toEqual(g.checks);
      const primary = checks.filter(
        (c) => (c.outcome === "FAIL" || c.outcome === "UNKNOWN") && !c.cascade,
      );
      expect(primary.map((c) => ({ rule_id: c.ruleId, outcome: c.outcome }))).toEqual(g.blockers);
    },
  );

  it("reports the R-005 difference as a decimal string with its currency", () => {
    const p = evaluated.find((x) => x.invoice_number === "INV-1044")!;
    const r005 = runChecks(packageModel(p)).find((c) => c.ruleId === "R-005")!;
    expect(r005.data).toEqual({ line_difference: { amount: "500.00", currency: "AZN" } });
    expect(r005.message).toContain("KY-10: fakturada 110,00 AZN, sifarişdə 100,00 AZN × 50");
  });

  it("points evidence at the documents that exist, with a quote for each", () => {
    for (const p of evaluated) {
      const m = packageModel(p);
      for (const c of runChecks(m))
        for (const e of c.evidence) {
          expect(e.quote).not.toBe("");
          if (e.doc === "order") expect(m.order).not.toBeNull();
          if (e.doc === "delivery") expect(m.delivery).not.toBeNull();
        }
    }
  });

  it("quotes an unreadable PO as read, never as a value", () => {
    const p = evaluated.find((x) => x.invoice_number === "INV-1047")!;
    const r001 = runChecks(packageModel(p)).find((c) => c.ruleId === "R-001")!;
    expect(r001.evidence).toEqual([
      { doc: "invoice", anchor: "po", quote: "Sifariş №: PO-3?7 (oxunmur)" },
    ]);
  });
});
