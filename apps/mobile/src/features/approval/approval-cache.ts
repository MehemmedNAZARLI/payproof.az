import type { QueryClient } from "@tanstack/react-query";

import { homeKeys } from "@/features/home/queries";
import { packageDetailKeys } from "@/features/package-detail/queries";
import { packageKeys } from "@/features/packages/queries";
import type { PackageListQuery, Schemas } from "@/lib/api";
import { decimal, toCents } from "@/lib/money";

// After an approval the server has moved the package to APPROVED_READY. These write what it
// answered into every cached view at once (home, list, detail), then the views refetch to
// reconcile with the server. Nothing here decides anything the server has not already decided.

type Detail = Schemas["PackageDetail"];
type Page = Schemas["PackagePage"];
type Dashboard = Schemas["Dashboard"];
type Approval = Schemas["ApprovalRecord"];
const APPROVED = "APPROVED_READY" as const;

export function approvedDetail(d: Detail, approval: Approval): Detail {
  return {
    ...d,
    status: APPROVED,
    current_approval: approval,
    approvals: [...d.approvals.filter((a) => a.id !== approval.id), approval],
    summary: { ...d.summary, blocking: [] },
    // Exporting is the server's call; the refetch brings `can_export`.
    permissions: { ...d.permissions, can_approve: false },
  };
}

/** One list page as it reads after the approval, given the filters it was asked with. */
export function approvedPage(page: Page, query: PackageListQuery, id: string, at: string): Page {
  const i = page.items.findIndex((p) => p.id === id);
  if (i < 0) return page;
  if (query.status && !query.status.includes(APPROVED))
    return {
      ...page,
      items: page.items.filter((p) => p.id !== id),
      total_count: page.total_count - 1,
    };
  const items = [...page.items];
  items[i] = { ...items[i]!, status: APPROVED, blocking: [], problem_since: null, updated_at: at };
  return { ...page, items };
}

function minus(amounts: Schemas["CurrencyTotal"][], total: Schemas["Money"] | null) {
  if (!total) return amounts;
  return amounts
    .map((a) =>
      a.total.currency === total.currency
        ? {
            total: { ...a.total, amount: decimal(toCents(a.total.amount) - toCents(total.amount)) },
            package_count: a.package_count - 1,
          }
        : a,
    )
    .filter((a) => a.package_count > 0);
}

export function approvedDashboard(d: Dashboard, total: Schemas["Money"] | null): Dashboard {
  const counts = d.status_counts;
  return {
    ...d,
    status_counts: {
      ...counts,
      READY_FOR_APPROVAL: Math.max(0, counts.READY_FOR_APPROVAL - 1),
      APPROVED_READY: counts.APPROVED_READY + 1,
    },
    ready_amounts: minus(d.ready_amounts, total),
  };
}

/** Show the approval everywhere now, then let every view confirm it with the server. */
export async function applyApproval(qc: QueryClient, pkg: Detail, approval: Approval) {
  // A refetch that started before the approval must not land on top of it.
  await Promise.all([
    qc.cancelQueries({ queryKey: packageKeys.all }),
    qc.cancelQueries({ queryKey: homeKeys.dashboard() }),
  ]);
  // A replayed or earlier approval is already counted; only a new one moves the counts.
  const isNew =
    pkg.status === "READY_FOR_APPROVAL" && !pkg.approvals.some((a) => a.id === approval.id);
  qc.setQueryData<Detail>(
    packageDetailKeys.detail(pkg.id),
    (d) => d && approvedDetail(d, approval),
  );
  for (const [key, page] of qc.getQueriesData<Page>({ queryKey: packageKeys.lists() })) {
    const query = (key[2] ?? {}) as PackageListQuery;
    if (page) qc.setQueryData(key, approvedPage(page, query, pkg.id, approval.approved_at));
  }
  if (isNew)
    qc.setQueryData<Dashboard>(homeKeys.dashboard(), (d) => d && approvedDashboard(d, pkg.total));
  // Not awaited: the user moves on to the success screen while the views confirm.
  void Promise.all([
    qc.invalidateQueries({ queryKey: packageKeys.all }),
    qc.invalidateQueries({ queryKey: homeKeys.dashboard() }),
    qc.invalidateQueries({ queryKey: ["audit"] }),
    qc.invalidateQueries({ queryKey: ["notifications"] }),
  ]);
}
