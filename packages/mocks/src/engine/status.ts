// Derived package status (R-010) — never stored as truth. Port of the prototype's info().
import type { MockDb } from "../store";
import type { Approval, Pkg } from "../types";
import { evaluate, rulesFor, type Check } from "./index";

export type PackageStatus =
  | "PROCESSING"
  | "NEEDS_REVIEW"
  | "NEEDS_FIX"
  | "READY_FOR_APPROVAL"
  | "APPROVED_READY"
  | "EXPORTED";

export interface Info {
  status: PackageStatus;
  checks: Check[];
  /** FAIL or UNKNOWN — every one blocks approval. */
  blockers: Check[];
  /** Blockers that are problems themselves (cascade results are not counted on dashboards). */
  primary: Check[];
  counts: { pass: number; fail: number; unknown: number; not_applicable: number };
}

/** Valid approval of the current version under the rule set currently in force. */
export function currentApproval(db: MockDb, p: Pkg): Approval | undefined {
  const rv = rulesFor(db, p).version;
  return p.approvals.find(
    (a) => a.valid && a.package_version === p.version && a.requirement_set_version === rv,
  );
}

export function info(db: MockDb, p: Pkg): Info {
  const counts = { pass: 0, fail: 0, unknown: 0, not_applicable: 0 };
  if (p.processing) return { status: "PROCESSING", checks: [], blockers: [], primary: [], counts };
  const checks = evaluate(db, p);
  for (const c of checks) {
    if (c.outcome === "PASS") counts.pass++;
    else if (c.outcome === "FAIL") counts.fail++;
    else if (c.outcome === "UNKNOWN") counts.unknown++;
    else counts.not_applicable++;
  }
  const blockers = checks.filter((c) => c.outcome === "FAIL" || c.outcome === "UNKNOWN");
  let status: PackageStatus;
  if (!p.order_link.confirmed) status = "NEEDS_REVIEW";
  else if (counts.fail) status = "NEEDS_FIX";
  else if (!checks.length || blockers.length)
    status = "NEEDS_REVIEW"; // no run yet is never ready
  else if (currentApproval(db, p))
    status = p.exports.some((e) => e.package_version === p.version) ? "EXPORTED" : "APPROVED_READY";
  else status = "READY_FOR_APPROVAL";
  return { status, checks, blockers, primary: blockers.filter((c) => !c.cascade), counts };
}
