// Deterministic rule engine — TS port of the prototype's runChecks()/info() (docs/architecture/rules-engine.md).
// Money in integer cents. UNKNOWN is never PASS.
import type { MockDb } from "../store";
import type { EnginePkg, Order, RequirementSet } from "../types";
import { ev, type Ev } from "./evidence";
import { r007, r008, r009 } from "./delivery-rules";
import { r005, r006 } from "./line-rules";
import { r003, r004 } from "./party-rules";
import { r001, r002 } from "./po-rules";

export type Outcome = "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";
export type FixHint =
  "edit_field" | "upload_invoice" | "upload_delivery" | "link_order" | "review_signature" | null;
export interface Check {
  rule_id: string;
  outcome: Outcome;
  cascade: boolean;
  message: string;
  evidence: Ev[];
  fix_hint: FixHint;
  data: Record<string, unknown>;
}

/** Rule set in force: the one used by the current version's export, else the customer's latest. */
export function rulesFor(db: MockDb, p: EnginePkg): RequirementSet {
  const sets = db.customer(p.customer_id).requirement_sets;
  const exp = p.exports.find((e) => e.package_version === p.version);
  return (
    (exp && sets.find((r) => r.version === exp.requirement_set_version)) || sets[sets.length - 1]!
  );
}

export interface Ctx {
  db: MockDb;
  p: EnginePkg;
  r: RequirementSet;
  o: Order | null;
  out: Check[];
  add(
    id: string,
    outcome: Outcome,
    message: string,
    evidence?: (Ev | null)[],
    x?: Partial<Check>,
  ): void;
  E(doc: Ev["doc"], hl: string): Ev | null;
  poUnread: boolean;
  comparable: boolean;
}

/** Evaluation order matters: R-004 sets `comparable`, R-008 reads R-007's outcome. */
export const RULES: ((ctx: Ctx) => void)[] = [r001, r002, r003, r004, r005, r006, r007, r008, r009];

export function evaluate(db: MockDb, p: EnginePkg): Check[] {
  const o =
    p.order_link.confirmed && p.order_link.po_number
      ? (db.orders[p.order_link.po_number] ?? null)
      : null;
  const out: Check[] = [];
  const ctx: Ctx = {
    db,
    p,
    o,
    out,
    r: rulesFor(db, p),
    comparable: false,
    poUnread: p.invoice.unreadable_fields.includes("po_ref"),
    E: (doc, hl) => ev(db, p, o, doc, hl),
    add: (rule_id, outcome, message, evidence = [], x = {}) =>
      out.push({
        rule_id,
        outcome,
        message,
        cascade: false,
        fix_hint: null,
        data: {},
        ...x,
        evidence: evidence.filter((e): e is Ev => e !== null),
      }),
  };
  for (const rule of RULES) rule(ctx);
  return out;
}
