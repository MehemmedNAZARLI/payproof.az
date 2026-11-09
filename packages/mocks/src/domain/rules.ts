// New customer requirement set version (approver only — checked by the HTTP layer). Sets are immutable;
// every not-exported package of the customer gets a new version and is re-validated (ADR-0009).
import type { MockDb } from "../store";
import type { Customer, RequirementSet } from "../types";
import { log } from "./audit";
import { bump, validate } from "./validate";

export type RuleInput = Omit<RequirementSet, "version" | "approved_by">;

export function saveRequirements(
  db: MockDb,
  c: Customer,
  input: RuleInput,
  actor: string,
): RequirementSet {
  const version = c.requirement_sets[c.requirement_sets.length - 1]!.version + 1;
  const set: RequirementSet = { ...input, version, approved_by: actor };
  c.requirement_sets.push(set);
  log(db, {
    actor,
    action: "requirements.updated",
    message: `${c.name}: qayda dəsti v${version} — ${input.reason}`,
    objectType: "requirement_set",
  });
  for (const p of db.packages) {
    if (p.deleted || p.processing || p.customer_id !== c.id) continue;
    if (p.exports.some((e) => e.package_version === p.version)) continue; // exported under its own rules
    // ADR-0009: a rule change is a new package version — approval invalidated (audited), approver notified
    bump(db, p, `qayda dəsti v${version} qüvvəyə mindi`);
    validate(db, p);
  }
  return set;
}
