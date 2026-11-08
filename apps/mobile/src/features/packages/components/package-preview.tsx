"use client";

import { AppHeader } from "@/components/ui/app-header";
import { PackageStatusBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";

import { usePackages } from "../queries";

// shortcut: a summary from the list until the detail screen (M-07) brings GET /v1/packages/{id}.
export function PackagePreview({ id }: { id: string }) {
  const list = usePackages({ limit: 100 });
  const p = list.data?.items.find((item) => item.id === id);
  const back = { href: "/packages", label: t.nav.packages };

  if (list.isPending)
    return (
      <>
        <AppHeader title={t.common.loading} back={back} />
        <main className="px-safe mx-auto max-w-app pt-2">
          <Skeleton className="h-36 rounded-lg" />
        </main>
      </>
    );
  if (!p)
    return (
      <>
        <AppHeader title={t.detail.notFound} back={back} />
        <main className="px-safe mx-auto max-w-app pt-2">
          <Card className="p-0">
            <EmptyState
              icon="package"
              title={t.detail.notFound}
              description={t.detail.notFoundBody}
            />
          </Card>
        </main>
      </>
    );
  return (
    <>
      <AppHeader
        title={p.invoice_number ?? t.packageItem.processing}
        subtitle={p.customer.name}
        back={back}
      />
      <main className="px-safe pb-safe mx-auto max-w-app pt-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-3 text-sm">{t.detail.amount}</span>
            <PackageStatusBadge status={p.status} />
          </div>
          <p className="mt-1 text-[30px] leading-tight font-bold tracking-tight tabular-nums">
            {p.total ? formatMoney(p.total.amount, p.total.currency) : "—"}
          </p>
          <p className="text-text-2 mt-1 text-sm">
            {p.customer.name} · v{p.version}
          </p>
        </Card>
        <Banner
          tone="info"
          icon="monitor"
          title={t.detail.soonTitle}
          className="mt-4"
          action={
            <a
              href={`${env.webUrl}/packages/${p.id}`}
              className="text-brand-600 flex min-h-11 items-center text-md font-semibold active:opacity-50"
            >
              {t.detail.openWeb}
            </a>
          }
        >
          {t.detail.soonBody}
        </Banner>
      </main>
    </>
  );
}
