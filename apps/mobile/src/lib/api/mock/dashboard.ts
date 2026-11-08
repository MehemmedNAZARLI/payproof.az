import customers from "@fixtures/customers.json";
import expected from "@fixtures/expected.json";
import packages from "@fixtures/packages.json";
import tasks from "@fixtures/tasks.json";

import type { Schemas } from "../client";
import { livePackages, sessionApprovalRecords } from "./live";
import { decimal, toCents } from "./money";
import { mockUuid, packageList, toUtc, userRef } from "./store";

type Item = Schemas["PackageListItem"];
type Status = Schemas["PackageStatus"];

// The prototype's problem categories (CAT), for the dashboard's top issue.
const CATEGORY: Record<string, string> = {
  "R-001": "PO istinadı",
  "R-002": "PO istinadı",
  "R-003": "Tərəf uyğunsuzluğu",
  "R-004": "Valyuta / vahid",
  "R-005": "Qiymət / miqdar",
  "R-006": "Qiymət / miqdar",
  "R-007": "Təhvil sənədi",
  "R-008": "Təhvil sənədi",
  "R-009": "Cəm fərqi",
};
const STATUSES: Status[] = [
  "PROCESSING",
  "NEEDS_REVIEW",
  "NEEDS_FIX",
  "READY_FOR_APPROVAL",
  "APPROVED_READY",
  "EXPORTED",
];
const DAY_MS = 86_400_000;
const isProblem = (p: Item) => p.status === "NEEDS_FIX" || p.status === "NEEDS_REVIEW";
const ref = (p: Item): Schemas["PackageRef"] => ({
  id: p.id,
  invoice_number: p.invoice_number ?? "",
});

/** Invoice totals per currency, in integer cents — AZN and USD are never added together. */
function perCurrency(items: Item[]): Schemas["CurrencyTotal"][] {
  const sums = new Map<string, { cents: bigint; count: number }>();
  for (const { total } of items) {
    if (!total) continue;
    const s = sums.get(total.currency) ?? { cents: 0n, count: 0 };
    sums.set(total.currency, {
      cents: s.cents + toCents(total.amount),
      count: s.count + 1,
    });
  }
  return [...sums].map(([currency, { cents, count }]) => ({
    total: {
      amount: decimal(cents),
      currency: currency as Schemas["Currency"],
    },
    package_count: count,
  }));
}

// Calendar days between Baku dates, as the prototype counts problem age.
const bakuDays = (from: string, to: string) =>
  Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY_MS);

function problemAge(open: Item[]): Schemas["Dashboard"]["problem_age"] {
  const ages = open.map((p) => {
    const created = packages.find((f) => mockUuid("package", f.id) === p.id)?.created_at ?? "";
    return { p, days: Math.max(0, bakuDays(created, expected.demo_now)) };
  });
  const sum = ages.reduce((a, x) => a + x.days, 0);
  const longest = ages.reduce<(typeof ages)[number] | null>(
    (m, x) => (x.days > (m?.days ?? -1) ? x : m),
    null,
  );
  return {
    average_days: (ages.length ? sum / ages.length : 0).toFixed(1),
    longest: longest && { package: ref(longest.p), days: longest.days },
  };
}

function issues(items: Item[]) {
  const rules = new Map<string, { fail: number; unknown: number }>();
  const categories = new Map<string, { rules: Set<string>; invoices: Set<string> }>();
  for (const p of items.filter((i) => i.status !== "EXPORTED")) {
    for (const b of p.blocking) {
      const r = rules.get(b.rule_id) ?? { fail: 0, unknown: 0 };
      r[b.outcome === "FAIL" ? "fail" : "unknown"]++;
      rules.set(b.rule_id, r);
      const name = CATEGORY[b.rule_id] ?? b.rule_id;
      const c = categories.get(name) ?? { rules: new Set(), invoices: new Set() };
      c.rules.add(b.rule_id);
      c.invoices.add(p.invoice_number ?? "");
      categories.set(name, c);
    }
  }
  // First category with the most packages wins, as in the prototype (stable sort).
  const top = [...categories].sort((a, b) => b[1].invoices.size - a[1].invoices.size)[0];
  return {
    top_issue: top
      ? {
          category: top[0],
          rule_ids: [...top[1].rules].sort() as Schemas["RuleId"][],
          package_count: top[1].invoices.size,
          invoice_numbers: [...top[1].invoices].sort(),
        }
      : null,
    rule_counts: [...rules]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([rule_id, r]) => ({ rule_id: rule_id as Schemas["RuleId"], ...r })),
  };
}

function recentApprovals(): Schemas["Dashboard"]["recent_approvals"] {
  return packages
    .flatMap((f) => {
      const item = packageList.find((p) => p.id === mockUuid("package", f.id));
      if (!item?.total) return [];
      const total = item.total;
      const fixture = f.approvals.map((a) => ({
        package: ref(item),
        version: a.package_version,
        approver: userRef(a.approver_id),
        approved_at: toUtc(a.created_at),
        total,
        valid: a.valid,
        exported: f.exports.some((e) => e.package_version === a.package_version),
      }));
      const session = sessionApprovalRecords(item.id).map((a) => ({
        package: ref(item),
        version: a.package_version,
        approver: a.approver,
        approved_at: a.approved_at,
        total,
        valid: true,
        exported: false,
      }));
      return [...fixture, ...session];
    })
    .sort((a, b) => b.approved_at.localeCompare(a.approved_at))
    .slice(0, 5);
}

/** GET /v1/dashboard over the fixtures, as of the demo's "now". */
export function dashboard(items: readonly Item[] = livePackages()): Schemas["Dashboard"] {
  const list = [...items];
  const of = (...s: Status[]) => list.filter((p) => s.includes(p.status));
  return {
    as_of: toUtc(expected.demo_now),
    package_count: list.length,
    customer_count: customers.length,
    status_counts: Object.fromEntries(
      STATUSES.map((s) => [s, of(s).length]),
    ) as Schemas["Dashboard"]["status_counts"],
    open_problem_amounts: perCurrency(list.filter(isProblem)),
    ready_amounts: perCurrency(of("READY_FOR_APPROVAL")),
    ...issues(list),
    problem_age: problemAge(list.filter(isProblem)),
    tasks: { resolved: tasks.filter((t) => t.status === "RESOLVED").length, total: tasks.length },
    recent_approvals: recentApprovals(),
  };
}
