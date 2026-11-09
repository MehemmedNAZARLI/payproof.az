import { describe, expect, it } from "vitest";
import expected from "../../../fixtures/scenarios/unec.expected.json";
import scenario from "../../../fixtures/scenarios/unec.json";
import { fillTemplate } from "../src/checks/template";
import type { GenericPkg, GenericRequirementSet } from "../src/checks";

const rs = scenario.customer.requirement_sets[0] as unknown as GenericRequirementSet;
const pkg = () => structuredClone(scenario.packages[0]) as unknown as GenericPkg;
const want = expected.packages["QR-2026-0914"];
const approval = { approver_name: "Rəşad Əliyev", approved_on: "2026-11-09" };

describe("output template fill (UNEC act)", () => {
  it("fills document-derived placeholders from validated fields; approval ones wait for approval", () => {
    const fill = fillTemplate(pkg(), rs, null);
    expect(Object.fromEntries(fill.values.map((v) => [v.placeholder, v.value]))).toEqual(
      want.template_values,
    );
    expect(fill.missing.map((m) => m.placeholder)).toEqual(want.filled_at_export);
  });

  it("after approval every mapped placeholder has a value", () => {
    const fill = fillTemplate(pkg(), rs, approval);
    expect(fill.missing).toEqual([]);
    expect(fill.values).toContainEqual({ placeholder: "{{approved_by}}", value: "Rəşad Əliyev" });
  });

  it("an unreadable mapped field refuses the export and names the placeholders", () => {
    const p = pkg();
    const { unreadable, missing_placeholders } = expected.export_refusal;
    for (const u of unreadable) {
      const d = p.documents.find((x) => x.id === u.document_id)!;
      d.unreadable.push(u.field);
      d.fields[u.field] = null;
    }
    const fill = fillTemplate(p, rs, approval);
    expect(fill.missing.map((m) => m.placeholder)).toEqual(missing_placeholders);
    expect(fill.missing[0]!.source).toEqual({
      kind: "field",
      document_type: "bank_statement",
      field: "account_holder.name",
    });
  });

  it("a sum over mixed currencies is never produced", () => {
    const p = pkg();
    p.documents[0]!.fields.currency = "USD";
    const fill = fillTemplate(p, rs, approval);
    expect(fill.missing.map((m) => m.placeholder)).toEqual(["{{total_spent}}"]);
  });

  it("a customer without an output template has nothing to fill", () => {
    expect(fillTemplate(pkg(), { ...rs, output: null }, approval)).toEqual({
      values: [],
      missing: [],
    });
  });
});
