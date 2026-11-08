"use client";

import type { ReactNode } from "react";

import { AppHeader } from "@/components/ui/app-header";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, type Schemas } from "@/lib/api";
import { t } from "@/lib/i18n";
import { errorMessage } from "@/lib/query-client";

import { packageCta } from "../cta";
import { usePackage } from "../queries";
import { ChecksList } from "./checks-list";
import { CtaBar, OpenOnWeb } from "./cta-bar";
import { DocumentsList } from "./documents-list";
import { SummaryCard } from "./summary-card";
import { TasksList } from "./tasks-list";

const back = { href: "/packages", label: t.nav.packages };

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <AppHeader title={title} back={back} />
      <main className="px-safe pb-safe mx-auto max-w-app pt-2">{children}</main>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label={t.common.loading}>
      <Skeleton className="h-36 rounded-lg" />
      <Skeleton className="mt-8 h-6 w-32" />
      <Skeleton className="mt-3 h-64 rounded-lg" />
    </div>
  );
}

export function PackageDetailView({ pkg }: { pkg: Schemas["PackageDetail"] }) {
  return (
    <>
      <AppHeader
        title={pkg.invoice_number ?? t.packageItem.processing}
        subtitle={pkg.customer.name}
        back={back}
      />
      {/* Room for the pinned call to action, whichever of its states is showing. */}
      <main className="px-safe mx-auto max-w-app pt-2 pb-[calc(var(--safe-bottom)+10rem)]">
        <SummaryCard pkg={pkg} />
        {!pkg.link.confirmed && !pkg.processing && (
          <Banner
            tone="warning"
            icon="link"
            title={t.detail.linkPending}
            className="mt-3"
            action={<OpenOnWeb id={pkg.id} />}
          >
            {t.detail.linkPendingBody}
          </Banner>
        )}
        {!pkg.processing && <ChecksList pkg={pkg} />}
        <DocumentsList pkg={pkg} />
        <TasksList tasks={pkg.tasks} />
      </main>
      <CtaBar cta={packageCta(pkg)} id={pkg.id} />
    </>
  );
}

export function PackageDetailScreen({ id }: { id: string }) {
  const query = usePackage(id);
  // Loaded data stays on screen when a background refresh fails (a toast reports it).
  if (query.data) return <PackageDetailView pkg={query.data} />;
  if (query.error instanceof ApiError && query.error.status === 404)
    return (
      <Shell title={t.detail.notFound}>
        <Card className="p-0">
          <EmptyState
            icon="package"
            title={t.detail.notFound}
            description={t.detail.notFoundBody}
          />
        </Card>
      </Shell>
    );
  if (query.isError)
    return (
      <Shell title={t.nav.packages}>
        <Card className="p-0">
          <EmptyState
            icon="alert"
            title={t.detail.loadFailed}
            description={errorMessage(query.error)}
            action={
              <Button variant="secondary" onClick={() => void query.refetch()}>
                {t.common.retry}
              </Button>
            }
          />
        </Card>
      </Shell>
    );
  return (
    <Shell title={t.common.loading}>
      <DetailSkeleton />
    </Shell>
  );
}
