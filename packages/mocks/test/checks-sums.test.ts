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

  it("totals_sum: an unread total, an empty table or an unread currency is UNKNOWN, never NA", () => {
    const params = rs.checks.find((c) => c.id === "U-04")!.parameters as never;
    const p = pkg();
    invoice(p).unreadable = ["total"];
    invoice(p).fields.total = null;
    invoice(p).tables.lines = [];
    expect(f.totalsSum(p, params)).toMatchObject({ outcome: "UNKNOWN" });
    expect(f.totalsSum(p, params).evidence.length).toBeGreaterThan(0);
    const q = pkg();
    invoice(q).fields.currency = null;
    expect(f.totalsSum(q, params).outcome).toBe("UNKNOWN");
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
    const two = pkg();
    two.documents.push({ ...two.documents.find((d) => d.type === "bank_statement")!, id: "b2" });
    expect(f.dateWithinPeriod(two, params).outcome).toBe("UNKNOWN"); // ambiguous bound
  });
});

describe("check library: spending limit", () => {
  const params = rs.checks.find((c) => c.id === "U-06")!.parameters as never;

  it("sums invoice totals against the grant limit", () => {
    const v = f.amountWithinLimit(pkg(), params);
    expect(v).toMatchObject({
      outcome: "PASS",
      data: { total: { amount: "1290.00", currency: "AZN" } },
    });
    const p = pkg();
    invoice(p).fields.total = "400.00";
    const over = f.amountWithinLimit(p, params);
    expect(over.outcome).toBe("FAIL");
    expect(over.message).toContain("55.00 AZN aşır");
  });

  it("a total in another currency is never converted — UNKNOWN", () => {
    const p = pkg();
    invoice(p).fields.currency = "USD";
    expect(f.amountWithinLimit(p, params).outcome).toBe("UNKNOWN");
    const q = pkg();
    invoice(q).fields.currency = null; // not read — not assumed to be the package currency
    expect(f.amountWithinLimit(q, params).outcome).toBe("UNKNOWN");
  });
});
