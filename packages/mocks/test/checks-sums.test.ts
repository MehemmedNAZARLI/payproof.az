import { describe, expect, it } from "vitest";
import scenario from "../../../fixtures/scenarios/unec.json";
import * as sums from "../src/checks/families-sums";
import type { FieldRef, GenericPkg, GenericRequirementSet } from "../src/checks/types";

const f = sums;
const rs = scenario.customer.requirement_sets[0] as unknown as GenericRequirementSet;
const pkg = () => structuredClone(scenario.packages[0]) as unknown as GenericPkg;
const ref = (document_type: string, field: string): FieldRef => ({ document_type, field });
const invoice = (p: GenericPkg) => p.documents.find((d) => d.type === "invoice")!;

describe("check library: line totals and date periods", () => {
  it("totals_sum: a line sum off by more than the tolerance fails with the difference", () => {
    const params = rs.checks.find((c) => c.id === "U-04")!.parameters as never;
    expect(f.totalsSum(pkg(), params).outcome).toBe("PASS");
    const p = pkg();
    invoice(p).fields.total = "136.00";
    const v = f.totalsSum(p, params);
    expect(v.outcome).toBe("FAIL");
    expect(v.message).toContain("-1.00 AZN");
  });

  it("date_within_period: bounds from the bank statement; outside dates fail", () => {
    const params = rs.checks.find((c) => c.id === "U-05")!.parameters as never;
    expect(f.dateWithinPeriod(pkg(), params).outcome).toBe("PASS");
    const p = pkg();
    invoice(p).fields.invoice_date = "2026-11-02";
    const v = f.dateWithinPeriod(p, params);
    expect(v).toMatchObject({ outcome: "FAIL", data: { from: "2026-09-01", to: "2026-10-31" } });
    const q = pkg();
    q.documents.find((d) => d.type === "bank_statement")!.unreadable = ["period_end"];
    expect(f.dateWithinPeriod(q, params).outcome).toBe("UNKNOWN");
  });
});
