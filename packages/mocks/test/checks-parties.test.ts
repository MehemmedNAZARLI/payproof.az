import { describe, expect, it } from "vitest";
import scenario from "../../../fixtures/scenarios/unec.json";
import * as f from "../src/checks/families-parties";
import type { GenericPkg, GenericRequirementSet } from "../src/checks/types";

const rs = scenario.customer.requirement_sets[0] as unknown as GenericRequirementSet;
const param = (id: string) => rs.checks.find((c) => c.id === id)!.parameters as never;
const pkg = (i: number) => structuredClone(scenario.packages[i]) as unknown as GenericPkg;
const all = () => [pkg(0), pkg(1)];
describe("check library: duplicates, party identity, line items", () => {
  it("no_duplicate_use: the same seller + invoice number in another report of the customer fails", () => {
    expect(f.noDuplicateUse(pkg(1), param("U-08"), { others: all() }).outcome).toBe("PASS");
    const reused = pkg(1);
    reused.documents[0] = { ...pkg(0).documents[0]!, id: "reused" };
    const v = f.noDuplicateUse(reused, param("U-08"), { others: all() });
    expect(v.outcome).toBe("FAIL");
    expect(v.data).toMatchObject({
      duplicates: [{ key: "1403216781 · KE-2231", package: "QR-2026-0914" }],
    });
    const sameReport = pkg(0);
    sameReport.documents.push({ ...sameReport.documents[0]!, id: "again" });
    expect(f.noDuplicateUse(sameReport, param("U-08"), { others: [] }).outcome).toBe("FAIL");
  });

  it("party_identity_match: FİN decides even when the transliterated names differ", () => {
    const v = f.partyIdentityMatch(pkg(0), param("U-02"));
    expect(v).toMatchObject({ outcome: "PASS", data: { matched_on: "id_number" } });
    const p = pkg(0);
    const holder = p.documents.find((d) => d.type === "card_statement")!.fields.card_holder as {
      id_number: string;
    };
    holder.id_number = "7HD2KQ1";
    expect(f.partyIdentityMatch(p, param("U-02")).outcome).toBe("FAIL");
    const nameOnly = { ...(param("U-02") as object), match_on: ["name"] } as never;
    expect(f.partyIdentityMatch(pkg(0), nameOnly).outcome).toBe("FAIL"); // Həsənova ≠ HASANOVA
  });

  it("line_items_match: compares columns by key; money within tolerance; a missing row is UNKNOWN", () => {
    const p = pkg(0);
    const inv = p.documents.find((d) => d.id === "unec_0914_ol5520")!;
    const receipt = { ...structuredClone(inv), id: "r1", type: "receipt" };
    p.documents = [inv, receipt];
    const params = {
      left: { document_type: "invoice", table: "lines" },
      right: { document_type: "receipt", table: "lines" },
      key_column: "description",
      compare: ["qty", "amount"],
    };
    expect(f.lineItemsMatch(p, params).outcome).toBe("PASS");
    receipt.tables.lines![1]!.amount = "60.01";
    expect(f.lineItemsMatch(p, params).outcome).toBe("FAIL");
    expect(f.lineItemsMatch(p, { ...params, tolerance: "0.01" }).outcome).toBe("PASS");
    receipt.tables.lines!.pop();
    expect(f.lineItemsMatch(p, params).outcome).toBe("UNKNOWN");
  });
});
