// Parity source for the backend (B-28): every case of fixtures/scenarios/unec.mutations.json evaluated by
// this reference implementation. The file must equal the output; UPDATE_REFERENCE=1 rewrites it.
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import mutations from "../../../fixtures/scenarios/unec.mutations.json";
import scenario from "../../../fixtures/scenarios/unec.json";
import { evaluate, genericStatus, primaryBlockers } from "../src/checks";
import { fillTemplate, type Approval } from "../src/checks/template";
import type { CheckConfig, GenericDoc, GenericPkg, GenericRequirementSet } from "../src/checks";

const FILE = new URL("../../../fixtures/scenarios/unec.reference.json", import.meta.url);
type Op = Record<string, unknown> & { op: string };

function apply(p: GenericPkg, rs: GenericRequirementSet, op: Op) {
  const doc = () => p.documents.find((d) => d.id === op.doc)!;
  const table = () => (doc().tables[op.table as string] ??= []);
  switch (op.op) {
    case "set": {
      const [top, part] = (op.path as string).split(".") as [string, string?];
      if (part === undefined) doc().fields[top] = op.value;
      else (doc().fields[top] as Record<string, unknown>)[part] = op.value;
      return;
    }
    case "unreadable":
      doc().fields[op.field as string] = null;
      doc().unreadable.push(op.field as string);
      return;
    case "drop_evidence":
      delete doc().evidence[op.key as string];
      return;
    case "row":
      table()[op.index as number]![op.column as string] = op.value;
      return;
    case "append_row": {
      const t = table();
      const from = op.from as number;
      doc().evidence[`${op.table}[${t.length}]`] = doc().evidence[`${op.table}[${from}]`]!;
      t.push({ ...t[from] });
      return;
    }
    case "clear_table":
      doc().tables[op.table as string] = [];
      return;
    case "unreadable_table":
      doc().unreadable.push(op.table as string);
      return;
    case "remove":
      p.documents = p.documents.filter((d) => d.id !== op.doc);
      return;
    case "copy":
      p.documents.push({ ...structuredClone(doc()), id: op.as as string });
      return;
    case "add":
      p.documents.push(structuredClone(op.document) as GenericDoc);
      return;
    case "param":
      rs.checks.find((c) => c.id === op.check)!.parameters[op.name as string] = op.value;
      return;
    case "add_check":
      rs.checks.push(structuredClone(op.check) as CheckConfig);
      return;
    default:
      throw new Error(`unknown op ${op.op}`);
  }
}

/** The reference output of every case (shared by this test and the backend's golden test). */
export function reference() {
  const out: Record<string, unknown> = {};
  for (const c of mutations.cases) {
    const packages = structuredClone(scenario.packages) as unknown as GenericPkg[];
    const rs = structuredClone(
      scenario.customer.requirement_sets[0],
    ) as unknown as GenericRequirementSet;
    const p = packages.find((x) => x.reference === c.package)!;
    for (const op of c.ops as Op[]) apply(p, rs, op);
    const results = evaluate(p, rs, { others: packages });
    const approval = ("approval" in c ? c.approval : mutations.approval) as Approval | null;
    out[c.name] = {
      status: genericStatus(results),
      primary_blockers: primaryBlockers(results),
      results,
      template: fillTemplate(p, rs, approval),
    };
  }
  return out;
}

describe("check library reference (unec.reference.json)", () => {
  it("the committed reference equals this implementation's output", () => {
    const text = `${JSON.stringify(reference(), null, 2)}\n`;
    if (process.env.UPDATE_REFERENCE) writeFileSync(FILE, text);
    expect(readFileSync(FILE, "utf8")).toBe(text);
  });
});
