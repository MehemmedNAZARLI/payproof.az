import { describe, expect, it } from "vitest";
import scenario from "../../../fixtures/scenarios/unec.json";
import { transactionMatch } from "../src/checks/families-match";
import type { GenericPkg, GenericRequirementSet } from "../src/checks/types";

const rs = scenario.customer.requirement_sets[0] as unknown as GenericRequirementSet;
const params = rs.checks.find((c) => c.id === "U-07")!.parameters as never;
const pkg = (i: number) => structuredClone(scenario.packages[i]) as unknown as GenericPkg;
const card = (p: GenericPkg) => p.documents.find((d) => d.type === "card_statement")!;

describe("check library: invoice ↔ statement transaction match", () => {
  it("pairs every invoice with one bank or card debit and cites both sides", () => {
    const v = transactionMatch(pkg(0), params);
    expect(v.outcome).toBe("PASS");
    expect(v.data).toMatchObject({ unmatched: [], ambiguous: [] });
    const cited = v.evidence.map((e) => `${e.document_id}:${e.field}`);
    expect(cited).toContain("unec_0914_ke2231:total");
    expect(cited).toContain("unec_0914_card_statement:transactions[0]");
    expect(cited).toContain("unec_0914_bank_statement:transactions[1]");
  });

  it("an amount mismatch fails and shows the nearest transaction and the difference", () => {
    const v = transactionMatch(pkg(1), params);
    expect(v.outcome).toBe("FAIL");
    expect(v.message).toBe(
      "TM-88412.pdf (640.00 AZN): uyğun əməliyyat yoxdur; ən yaxın 604.00 AZN, fərq 36.00 AZN",
    );
    expect(v.evidence.map((e) => e.field)).toContain("transactions[2]");
  });

  it("a debit outside the date window or to another counterparty does not match", () => {
    const late = pkg(0);
    card(late).tables.transactions![0]!.date = "2026-09-16";
    expect(transactionMatch(late, params).outcome).toBe("FAIL");
    const other = pkg(0);
    card(other).tables.transactions![0]!.counterparty = "COFFEE MOFFIE";
    expect(transactionMatch(other, params).outcome).toBe("FAIL");
  });
});
