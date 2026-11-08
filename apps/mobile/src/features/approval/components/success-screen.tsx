"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { AppHeader } from "@/components/ui/app-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { webPackageHref } from "@/features/package-detail/components/cta-bar";
import { usePackage } from "@/features/package-detail/queries";
import type { Schemas } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";

// Staggered entrance: the mark first, then the words, then what to do next.
const rise = (step: number) => ({
  animation: `rise 520ms cubic-bezier(0.32, 0.72, 0, 1) ${120 + step * 70}ms both`,
});

function SuccessMark() {
  return (
    <div className="relative mx-auto grid size-24 place-items-center" aria-hidden="true">
      <span
        className="bg-success absolute inset-0 rounded-full"
        style={{ animation: "success-halo 900ms ease-out 260ms both" }}
      />
      <span
        className="bg-success shadow-2 relative grid size-24 place-items-center rounded-full"
        style={{ animation: "success-pop 520ms cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
      >
        <svg viewBox="0 0 24 24" className="text-surface size-12" fill="none">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            pathLength={1}
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={1}
            style={{ animation: "success-draw 420ms cubic-bezier(0.65, 0, 0.35, 1) 300ms both" }}
          />
        </svg>
      </span>
    </div>
  );
}

function Approved({
  pkg,
  approval,
}: {
  pkg: Schemas["PackageDetail"];
  approval: Schemas["ApprovalRecord"];
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Screen readers land on the outcome, not on the header's close button.
  useEffect(() => heading.current?.focus(), []);
  const amount = pkg.total ? formatMoney(pkg.total.amount, pkg.total.currency) : "—";
  const rows: [string, string][] = [
    [t.success.approver, approval.approver.full_name],
    [t.success.time, formatDateTime(approval.approved_at)],
    [t.success.version, `v${approval.package_version}`],
    [t.success.ruleSet, `v${approval.requirement_set_version}`],
    [t.success.checks, t.success.checksValue(pkg.summary.pass, pkg.summary.not_applicable)],
  ];
  return (
    <>
      <div className="pt-6 pb-2 text-center">
        <SuccessMark />
        <h2
          ref={heading}
          tabIndex={-1}
          className="mt-6 text-2xl font-bold tracking-tight outline-none"
          style={rise(1)}
        >
          {t.success.heading}
        </h2>
        <p className="text-text-2 mx-auto mt-2 max-w-80 text-md text-pretty" style={rise(2)}>
          {t.success.body(amount, pkg.invoice_number ?? "", approval.package_version)}
        </p>
        <p className="text-text-3 mx-auto mt-2 max-w-80 text-sm text-pretty" style={rise(2)}>
          {t.success.notPayment}
        </p>
      </div>
      <Card className="mt-5 py-1" style={rise(3)}>
        <dl>
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="hairline-b flex justify-between gap-3 py-3 text-sm last:shadow-none"
            >
              <dt className="text-text-3">{k}</dt>
              <dd className="text-right font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="mt-6 flex flex-col gap-2" style={rise(4)}>
        <a
          href={webPackageHref(pkg.id)}
          className="bg-brand-600 text-brand-foreground shadow-1 flex h-13 items-center justify-center gap-2 rounded-lg text-lg font-semibold transition-[transform,opacity] active:scale-[0.97] active:opacity-85"
        >
          <Icon name="monitor" size={22} />
          {t.success.exportOnWeb}
        </a>
        <Link
          href="/home"
          className="bg-brand-50 text-brand-700 flex h-13 items-center justify-center rounded-lg text-lg font-semibold transition-[transform,opacity] active:scale-[0.97] active:opacity-85"
        >
          {t.success.home}
        </Link>
      </div>
    </>
  );
}

export function SuccessScreen({ id }: { id: string }) {
  const query = usePackage(id);
  const pkg = query.data;
  const approval = pkg?.current_approval;
  return (
    <>
      <AppHeader
        title={t.success.title}
        subtitle={pkg?.invoice_number ?? undefined}
        trailing={
          <Link
            href={`/packages/${id}`}
            aria-label={t.success.close}
            className="text-text-2 grid size-11 place-items-center rounded-full active:opacity-50"
          >
            <Icon name="x" size={22} strokeWidth={2.4} />
          </Link>
        }
      />
      <main className="px-safe pb-safe mx-auto max-w-app pt-2">
        {pkg && approval ? (
          <Approved pkg={pkg} approval={approval} />
        ) : pkg || query.isError ? (
          <Card className="p-0">
            <EmptyState
              icon="info"
              title={t.success.noneTitle}
              description={t.success.noneBody}
              action={
                <Link href={`/packages/${id}`} className="text-brand-600 font-semibold">
                  {t.success.toPackage}
                </Link>
              }
            />
          </Card>
        ) : (
          <div aria-busy="true" aria-label={t.common.loading} className="pt-6">
            <Skeleton className="mx-auto size-24 rounded-full" />
            <Skeleton className="mx-auto mt-6 h-7 w-64" />
            <Skeleton className="mt-8 h-48 rounded-lg" />
          </div>
        )}
      </main>
    </>
  );
}
