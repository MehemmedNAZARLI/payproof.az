// Reference evaluator of configured checks (ADR-0011) — the golden source for the backend's generic engine,
// as the prototype's runChecks() is for R-001…R-009. Pure: same input → same results; AI output never enters.
import { documentCount, fieldPresent, valuesEqual } from "./families-basic";
import { transactionMatch } from "./families-match";
import { lineItemsMatch, noDuplicateUse, partyIdentityMatch } from "./families-parties";
import { amountWithinLimit, dateWithinPeriod, totalsSum } from "./families-sums";
import type {
  EvalContext,
  GenericPkg,
  GenericRequirementSet,
  GenericResult,
  Verdict,
} from "./types";

type Family = (p: GenericPkg, params: never, ctx: EvalContext) => Verdict;
const FAMILIES: Record<string, Family> = {
  field_present: fieldPresent,
  values_equal: valuesEqual,
  totals_sum: totalsSum,
  date_within_period: dateWithinPeriod,
  amount_within_limit: amountWithinLimit,
  line_items_match: lineItemsMatch,
  transaction_match: transactionMatch,
  no_duplicate_use: noDuplicateUse,
  party_identity_match: partyIdentityMatch,
};

const result = (id: string, type: string, title: string, v: Verdict): GenericResult => ({
  rule_id: id,
  check_type: type,
  title,
  outcome: v.outcome,
  cascade: false,
  message: v.message,
  evidence: v.evidence,
  fix_hint: null,
  data: v.data ?? {},
});

/** D-001 (derived from `documents`) first, then every configured check in its configured order. */
export function evaluate(
  p: GenericPkg,
  rs: GenericRequirementSet,
  ctx: EvalContext,
): GenericResult[] {
  const results = [result("D-001", "document_count", "Sənəd dəsti tamdır", documentCount(p, rs))];
  for (const c of rs.checks) {
    const family = FAMILIES[c.type];
    if (!family) throw new Error(`${c.id}: unknown check type ${c.type}`);
    results.push(result(c.id, c.type, c.title, family(p, c.parameters as never, ctx)));
  }
  return results;
}

/** Same derivation as rules-engine.md R-010, without the order link (generic sets have none). */
export function genericStatus(results: GenericResult[]) {
  if (results.some((r) => r.outcome === "FAIL")) return "NEEDS_FIX" as const;
  if (results.some((r) => r.outcome === "UNKNOWN")) return "NEEDS_REVIEW" as const;
  return "READY_FOR_APPROVAL" as const;
}

export const primaryBlockers = (results: GenericResult[]) =>
  results
    .filter((r) => !r.cascade && (r.outcome === "FAIL" || r.outcome === "UNKNOWN"))
    .map((r) => r.rule_id);

export type * from "./types";
