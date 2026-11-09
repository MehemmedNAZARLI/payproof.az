// Package list items and the dashboard — amounts per currency, never converted or summed across.
import type { Schemas } from "@payproof/api-client";
import { bakuDaysBetween } from "@payproof/api-client/format";
import { ruleCategory } from "@payproof/api-client/i18n";
import { info } from "../engine/status";
import { cents, decimal } from "../money";
import type { MockDb } from "../store";
import type { Pkg } from "../types";
import { customerRef, pkgRef, userRef } from "./records";

const blocker = (c: { rule_id: string; outcome: string }) => ({
  rule_id: c.rule_id,
  outcome: c.outcome as "FAIL" | "UNKNOWN",
});
export const live = (db: MockDb) => db.packages.filter((p) => !p.deleted);

export const listItem = (db: MockDb, p: Pkg): Schemas["PackageListItem"] => {
  const i = info(db, p);
  return {
    id: pkgRef(db, p.id).id,
    invoice_number: p.invoice_number,
    version: p.version,
    status: i.status,
    customer: customerRef(db, p.customer_id),
    invoice_date: p.invoice_date,
    total: { amount: p.invoice.total, currency: p.currency },
    po_ref: p.invoice.po_ref,
    po_unreadable: p.invoice.unreadable_fields.includes("po_ref"),
    blocking: i.primary.map(blocker),
    owner: userRef(db, p.owner_id),
    problem_since: p.problem_since,
    updated_at: p.updated_at,
  };
};

function perCurrency(ps: Pkg[]): Schemas["CurrencyTotal"][] {
  const sums = new Map<string, { c: number; n: number }>();
  for (const p of ps) {
    const s = sums.get(p.currency) ?? { c: 0, n: 0 };
    sums.set(p.currency, { c: s.c + cents(p.invoice.total), n: s.n + 1 });
  }
  return [...sums].map(([currency, s]) => ({
    total: { amount: decimal(s.c), currency: currency as "AZN" },
    package_count: s.n,
  }));
}

export function dashboard(db: MockDb): Schemas["Dashboard"] {
  const ps = live(db).map((p) => ({ p, i: info(db, p) }));
  const status_counts = {
    PROCESSING: 0,
    NEEDS_REVIEW: 0,
    NEEDS_FIX: 0,
    READY_FOR_APPROVAL: 0,
    APPROVED_READY: 0,
    EXPORTED: 0,
  };
  for (const x of ps) status_counts[x.i.status]++;
  const open = ps.filter((x) => x.i.status === "NEEDS_FIX" || x.i.status === "NEEDS_REVIEW");
  const rules = new Map<string, { fail: number; unknown: number }>();
  const categories = new Map<string, { rule_ids: Set<string>; invoices: Set<string> }>();
  for (const x of ps.filter((y) => y.i.status !== "EXPORTED"))
    for (const c of x.i.primary) {
      const r = rules.get(c.rule_id) ?? { fail: 0, unknown: 0 };
      r[c.outcome === "FAIL" ? "fail" : "unknown"]++;
      rules.set(c.rule_id, r);
      const name = ruleCategory[c.rule_id as keyof typeof ruleCategory];
      const cat = categories.get(name) ?? { rule_ids: new Set(), invoices: new Set() };
      cat.rule_ids.add(c.rule_id);
      cat.invoices.add(x.p.invoice_number);
      categories.set(name, cat);
    }
  const top = [...categories].sort((a, b) => b[1].invoices.size - a[1].invoices.size)[0];
  const now = db.nowIso();
  const ages = open.map((x) => ({
    p: x.p,
    days: bakuDaysBetween(x.p.problem_since ?? x.p.created_at, now),
  }));
  const longest = ages.reduce<(typeof ages)[number] | null>(
    (m, a) => (!m || a.days > m.days ? a : m),
    null,
  );
  const approvals = ps
    .flatMap((x) => x.p.approvals.map((a) => ({ x, a })))
    .sort((u, w) => w.a.created_at.localeCompare(u.a.created_at))
    .slice(0, 5);
  return {
    as_of: db.nowIso(),
    package_count: ps.length,
    customer_count: new Set(ps.map((x) => x.p.customer_id)).size,
    status_counts,
    open_problem_amounts: perCurrency(open.map((x) => x.p)),
    ready_amounts: perCurrency(
      ps.filter((x) => x.i.status === "READY_FOR_APPROVAL").map((x) => x.p),
    ),
    top_issue: top
      ? {
          category: top[0],
          rule_ids: [...top[1].rule_ids].sort(),
          package_count: top[1].invoices.size,
          invoice_numbers: [...top[1].invoices],
        }
      : null,
    rule_counts: [...rules]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([rule_id, r]) => ({ rule_id, ...r })),
    problem_age: {
      average_days: (ages.length ? ages.reduce((s, a) => s + a.days, 0) / ages.length : 0).toFixed(
        1,
      ),
      longest: longest && { package: pkgRef(db, longest.p.id), days: longest.days },
    },
    tasks: {
      resolved: db.tasks.filter((t) => t.status === "RESOLVED").length,
      total: db.tasks.length,
    },
    recent_approvals: approvals.map(({ x, a }) => ({
      package: pkgRef(db, x.p.id),
      version: a.package_version,
      approver: userRef(db, a.approver_id),
      approved_at: a.created_at,
      total: { amount: x.p.invoice.total, currency: x.p.currency },
      valid: a.valid,
      exported: x.p.exports.some((e) => e.package_version === a.package_version),
    })),
  };
}
