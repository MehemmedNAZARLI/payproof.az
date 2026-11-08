import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { type PackageFilter, packagesHref } from "@/features/packages/filters";
import type { Schemas } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { type PackageStatus, t } from "@/lib/i18n";

type Dashboard = Schemas["Dashboard"];

const glass = "bg-[rgb(255_255_255/0.16)] ring-1 ring-[rgb(255_255_255/0.18)]";

/** The approver's main question: what is waiting for my approval, and for how much. */
export function ApprovalHero({
  dashboard,
  canApprove,
}: {
  dashboard: Dashboard;
  canApprove: boolean;
}) {
  const count = dashboard.status_counts.READY_FOR_APPROVAL;
  const label = canApprove ? t.home.awaitingYou : t.home.awaitingApprover;
  return (
    <Link
      href={packagesHref("ready")}
      className="hero relative block overflow-hidden rounded-[22px] p-5 shadow-2 transition-transform duration-base ease-base active:scale-[0.985]"
    >
      <span className="flex items-center justify-between">
        <span className="text-md font-semibold text-[rgb(255_255_255/0.86)]">{label}</span>
        <span className={`grid size-8 place-items-center rounded-full ${glass}`}>
          <Icon name="chev-r" size={18} strokeWidth={2.4} />
        </span>
      </span>
      <span className="mt-2 flex items-baseline gap-2">
        <span className="text-[56px] leading-none font-bold tracking-tight tabular-nums">
          {count}
        </span>
        <span className="text-lg font-medium text-[rgb(255_255_255/0.8)]">
          {t.home.packageUnit}
        </span>
      </span>
      {dashboard.ready_amounts.length > 0 && (
        <span className="mt-4 flex flex-wrap gap-2">
          {dashboard.ready_amounts.map(({ total }) => (
            <span
              key={total.currency}
              className={`inline-flex h-8 items-center rounded-full px-3 text-md font-semibold tabular-nums ${glass}`}
            >
              {formatMoney(total.amount, total.currency)}
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}

const tiles: { status: PackageStatus; filter: PackageFilter; icon: IconName; tint: string }[] = [
  { status: "NEEDS_FIX", filter: "problem", icon: "fail", tint: "bg-danger-bg text-danger" },
  {
    status: "NEEDS_REVIEW",
    filter: "problem",
    icon: "unknown",
    tint: "bg-warning-bg text-warning",
  },
  {
    status: "APPROVED_READY",
    filter: "approved",
    icon: "pass",
    tint: "bg-success-bg text-success",
  },
  { status: "EXPORTED", filter: "exported", icon: "download", tint: "bg-surface-2 text-text-2" },
];

/** Four status counts; each opens the package list with the matching filter. */
export function StatusTiles({ counts }: { counts: Dashboard["status_counts"] }) {
  return (
    <ul aria-label={t.home.summary} className="mt-3 grid grid-cols-2 gap-3">
      {tiles.map(({ status, filter, icon, tint }) => (
        <li key={status}>
          <Link
            href={packagesHref(filter)}
            className="bg-surface flex min-h-26 flex-col justify-between rounded-[18px] p-4 shadow-1 transition-transform duration-base ease-base active:scale-[0.97]"
          >
            <span className={`grid size-8 place-items-center rounded-full ${tint}`}>
              <Icon name={icon} size={18} strokeWidth={2} />
            </span>
            <span className="mt-3 block">
              <span className="block text-[28px] leading-none font-bold tracking-tight tabular-nums">
                {counts[status]}
              </span>
              <span className="text-text-2 mt-1 block text-sm leading-tight">
                {t.package.status[status]}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SummarySkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t.common.loading}</span>
      <Skeleton className="h-41 rounded-[22px]" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface flex min-h-26 flex-col justify-between rounded-[18px] p-4 shadow-1"
          >
            <Skeleton className="size-8 rounded-full" />
            <span className="flex flex-col gap-2">
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-3.5 w-3/4" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
