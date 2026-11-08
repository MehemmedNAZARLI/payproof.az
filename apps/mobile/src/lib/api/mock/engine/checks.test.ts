import expected from "@fixtures/expected.json";
import packages from "@fixtures/packages.json";
import { describe, expect, it } from "vitest";

import { runChecks } from "./checks";
import { packageModel } from "./model";

const evaluated = packages.filter((p) => !p.processing);
const RULES = ["R-001", "R-002", "R-003", "R-004"];
const golden = (invoice: string) => {
  const g = expected.packages[invoice as keyof typeof expected.packages];
  return {
    checks: Object.fromEntries(Object.entries(g.checks).filter(([r]) => RULES.includes(r))),
    blockers: g.blockers.filter((b) => RULES.includes(b.rule_id)),
  };
};

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
