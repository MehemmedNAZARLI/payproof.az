import { describe, expect, it } from "vitest";
import scenario from "../../../fixtures/scenarios/unec.json";
import * as basic from "../src/checks/families-basic";
import type { FieldRef, GenericPkg, GenericRequirementSet } from "../src/checks/types";

const f = basic;
const rs = scenario.customer.requirement_sets[0] as unknown as GenericRequirementSet;
const pkg = () => structuredClone(scenario.packages[0]) as unknown as GenericPkg;
const ref = (document_type: string, field: string): FieldRef => ({ document_type, field });
const invoice = (p: GenericPkg) => p.documents.find((d) => d.type === "invoice")!;

describe("check library: presence, equality, totals, periods", () => {
  it("document_count: a missing card statement fails and names the type", () => {
    const p = pkg();
    p.documents = p.documents.filter((d) => d.type !== "card_statement");
    const v = f.documentCount(p, rs);
    expect(v.outcome).toBe("FAIL");
    expect(v.data).toMatchObject({ missing: ["card_statement"] });
    expect(v.message).toContain("Kart çıxarışı (tələb: 1–1, var: 0)");
    expect(f.documentCount(pkg(), rs).outcome).toBe("PASS");
  });

  it("field_present: unreadable → UNKNOWN, absent → FAIL, both cite a source", () => {
    const targets = [ref("invoice", "seller.tax_id")];
    const p = pkg();
    invoice(p).unreadable = ["seller"];
    invoice(p).fields.seller = null;
    expect(f.fieldPresent(p, { targets }).outcome).toBe("UNKNOWN");
    const q = pkg();
    (invoice(q).fields.seller as { tax_id?: string }).tax_id = undefined;
    const v = f.fieldPresent(q, { targets });
    expect(v.outcome).toBe("FAIL");
    expect(v.evidence.length).toBeGreaterThan(0);
    expect(f.fieldPresent(pkg(), { targets: [ref("receipt", "total")] }).outcome).toBe(
      "NOT_APPLICABLE",
    );
  });

  it("values_equal: different currencies fail; money compares within tolerance", () => {
    const fields = [ref("invoice", "currency"), ref("bank_statement", "currency")];
    expect(f.valuesEqual(pkg(), { fields }).outcome).toBe("PASS");
    const p = pkg();
    p.documents.find((d) => d.type === "bank_statement")!.fields.currency = "USD";
    expect(f.valuesEqual(p, { fields }).outcome).toBe("FAIL");
    const totals = [ref("invoice", "total"), ref("contract", "total")];
    const q = pkg();
    q.documents = [
      invoice(q),
      { ...invoice(q), id: "x", fields: { ...invoice(q).fields, total: "135.01" } },
    ];
    expect(f.valuesEqual(q, { fields: [totals[0]!], tolerance: "0.01" }).outcome).toBe("PASS");
    expect(f.valuesEqual(q, { fields: [totals[0]!] }).outcome).toBe("FAIL");
    q.documents[1]!.fields = { ...q.documents[1]!.fields, total: "135.00", currency: "USD" };
    expect(f.valuesEqual(q, { fields: [totals[0]!] }).outcome).toBe("FAIL"); // 135 AZN ≠ 135 USD
    q.documents[1]!.fields.currency = null;
    expect(f.valuesEqual(q, { fields: [totals[0]!] }).outcome).toBe("UNKNOWN");
  });
});
