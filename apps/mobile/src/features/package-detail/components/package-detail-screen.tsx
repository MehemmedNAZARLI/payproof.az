"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/ui/app-header";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { OfflineCard } from "@/components/ui/offline-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApprovalFlow } from "@/features/approval/use-approval-flow";
import { ApiError, type Schemas } from "@/lib/api";
import { t } from "@/lib/i18n";
import { errorMessage } from "@/lib/query-client";
import { useSession } from "@/lib/session";

import { packageCta } from "../cta";
import { usePackage } from "../queries";
import { useSeen } from "../seen-store";
import { useSheetStack } from "../sheet-stack";
import { ChecksList } from "./checks-list";
import { CtaBar, OpenOnWeb } from "./cta-bar";
import { DocumentsList } from "./documents-list";
import { EvidenceSheet } from "./evidence-sheet";
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
  const userId = useSession()?.user.id;
  const seen = useSeen(userId, pkg);
  const sheet = useSheetStack();
  const approval = useApprovalFlow(pkg, seen.isSeen);
  const cta = packageCta(pkg);
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
        {!pkg.processing && (
          <ChecksList pkg={pkg} onOpen={(c) => sheet.open({ kind: "check", ruleId: c.rule_id })} />
        )}
        <DocumentsList
          pkg={pkg}
          isSeen={(d) => seen.isSeen(d.current.id)}
          onOpen={(d) =>
            sheet.open({
              kind: "document",
              documentId: d.id,
              versionId: d.current.id,
              evidence: null,
            })
          }
        />
        <TasksList tasks={pkg.tasks} />
      </main>
      <CtaBar
        cta={cta}
        id={pkg.id}
        onApprove={() => {
          approval.begin();
          sheet.open({ kind: "approve" });
        }}
      />
      <EvidenceSheet
        pkg={pkg}
        stack={sheet}
        onViewed={seen.markSeen}
        approval={
          cta.kind === "approve" || approval.pending || approval.failure ? approval : undefined
        }
      />
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
            action={
              <Link
                href="/packages"
                className="bg-brand-50 text-brand-700 inline-flex h-11 items-center rounded-lg px-4 text-md font-semibold active:opacity-85"
              >
                {t.detail.toPackages}
              </Link>
            }
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
  if (query.fetchStatus === "paused")
    return (
      <Shell title={t.nav.packages}>
        <OfflineCard />
      </Shell>
    );
  return (
    <Shell title={t.common.loading}>
      <DetailSkeleton />
    </Shell>
  );
}
