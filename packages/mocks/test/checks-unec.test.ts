// Golden: the UNEC grant settlement scenario evaluates exactly to fixtures/scenarios/unec.expected.json.
import { describe, expect, it } from "vitest";
import expected from "../../../fixtures/scenarios/unec.expected.json";
import scenario from "../../../fixtures/scenarios/unec.json";
import { evaluate, genericStatus, primaryBlockers } from "../src/checks";
import type { GenericPkg, GenericRequirementSet } from "../src/checks";
import { assertSchema } from "./contract";

const rs = scenario.customer.requirement_sets[0] as unknown as GenericRequirementSet;
const packages = scenario.packages as unknown as GenericPkg[];
interface Golden {
  status: string;
  results: Record<string, string>;
  primary_blockers: string[];
  data: Record<string, object>;
}
const golden = expected.packages as unknown as Record<string, Golden>;

describe.each(packages.map((p) => [p.reference, p] as const))("UNEC %s", (ref, p) => {
  const results = evaluate(p, rs, { others: packages });
  const want = golden[ref]!;

  it("outcomes, status and primary blockers match the golden file", () => {
    expect(Object.fromEntries(results.map((r) => [r.rule_id, r.outcome]))).toEqual(want.results);
    expect(genericStatus(results)).toBe(want.status);
    expect(primaryBlockers(results)).toEqual(want.primary_blockers);
  });

  it("computed values match the golden file", () => {
    for (const [id, data] of Object.entries(want.data))
      expect(results.find((r) => r.rule_id === id)!.data, id).toMatchObject(data);
  });

  it("every decided result cites sources inside the package's documents", () => {
    for (const r of results.filter((x) => x.outcome !== "NOT_APPLICABLE")) {
      expect(r.evidence.length, r.rule_id).toBeGreaterThan(0);
      for (const e of r.evidence) {
        const d = p.documents.find((x) => x.id === e.document_id);
        expect(d, `${r.rule_id} cites ${e.document_id}`).toBeDefined();
        expect(e.page).toBeLessThanOrEqual(d!.pages);
      }
    }
  });

  it("results fit the contract's CheckResult (document ids stand in for version uuids)", () => {
    for (const r of results) {
      const evidence = r.evidence.map((e) => ({
        document_version_id: "0193a000-0000-7000-8005-000000000001",
        page: e.page,
        quote: e.quote,
        bbox: null,
      }));
      assertSchema("CheckResult", { ...r, evidence });
    }
  });
});
