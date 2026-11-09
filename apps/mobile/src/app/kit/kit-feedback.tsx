"use client";

import { CheckOutcomeBadge, PackageStatusBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-store";
import type { PackageStatus } from "@/lib/i18n";

export function BadgesSection() {
  const statuses: PackageStatus[] = [
    "PROCESSING",
    "NEEDS_REVIEW",
    "NEEDS_FIX",
    "READY_FOR_APPROVAL",
    "APPROVED_READY",
    "EXPORTED",
  ];
  return (
    <>
      <SectionHeader title="Status badges" />
      <Card className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <PackageStatusBadge key={s} status={s} />
        ))}
        {(["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"] as const).map((o) => (
          <CheckOutcomeBadge key={o} outcome={o} />
        ))}
      </Card>
    </>
  );
}

export function BannersSection() {
  return (
    <>
      <SectionHeader title="Banners" />
      <div className="flex flex-col gap-2">
        <Banner
          tone="danger"
          icon="lock"
          title="Approval unavailable"
          action={<Button variant="secondary">Open on web</Button>}
        >
          1 blocking issues: R-005
        </Banner>
        <Banner tone="accent" icon="lock" title="Awaiting approver">
          Only an approver can approve a ready package.
        </Banner>
        <Banner tone="neutral" icon="clock" title="Processing">
          You will be notified when the results are ready.
        </Banner>
      </div>
    </>
  );
}

export function FeedbackSection() {
  return (
    <>
      <SectionHeader title="Loading and empty states" />
      <ListSkeleton rows={2} />
      <Card className="mt-2 p-0">
        <EmptyState
          icon="pass"
          title="No packages awaiting approval"
          description="Packages that pass every required check will appear here."
        />
      </Card>
      <SectionHeader title="Notifications" />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          block
          icon="pass"
          onClick={() => toast.success("Package approved.")}
        >
          Success
        </Button>
        <Button
          variant="secondary"
          block
          icon="fail"
          onClick={() => toast.error("Network error", "Check your connection and try again.")}
        >
          Error
        </Button>
      </div>
    </>
  );
}
