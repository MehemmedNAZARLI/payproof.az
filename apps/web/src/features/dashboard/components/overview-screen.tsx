"use client";

import { formatDateLong } from "@payproof/api-client/format";
import { ui } from "@payproof/api-client/i18n";
import { Package } from "lucide-react";
import Link from "next/link";
import { useMe } from "@/features/auth";
import { Button } from "@/components/ui/button";
import { Banner, PageHeader } from "@/components/ui/layout";
import { Loading, SkeletonBar } from "@/components/ui/skeleton";
import { NewPackageButton } from "@/features/packages";
import { useDashboard } from "../queries";
import { ApprovalHistory, AttentionPackages } from "./activity";
import { RuleBars, StatusDonut } from "./charts";
import { IntroCard } from "./intro-card";
import { KpiCards } from "./kpi-cards";
import { SummaryCards } from "./summary-cards";

export function OverviewScreen() {
  const dashboard = useDashboard();
  const company = useMe().data?.company.name;
  const d = dashboard.data;

  return (
    <div className="@container flex flex-col gap-4">
      <PageHeader
        title="İcmal"
        description={
          d &&
          `${company} · ${formatDateLong(d.as_of)} vəziyyəti · ${d.package_count} unikal faktura paketi`
        }
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/packages">
                <Package aria-hidden />
                Paketlərə bax
              </Link>
            </Button>
            <NewPackageButton />
          </>
        }
      />
      {dashboard.isPending && (
        <Loading className="grid gap-4 @lg:grid-cols-2 @4xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBar key={i} className="h-32 rounded-lg" />
          ))}
        </Loading>
      )}
      {dashboard.isError && (
        <Banner
          tone="danger"
          role="alert"
          title={ui.errorTitle}
          actions={
            <Button variant="outline" onClick={() => dashboard.refetch()}>
              {ui.retry}
            </Button>
          }
        >
          {dashboard.error.message}
        </Banner>
      )}
      {d && (
        <>
          <IntroCard />
          <KpiCards dashboard={d} />
          <SummaryCards dashboard={d} />
          <div className="grid gap-4 @4xl:grid-cols-2">
            <RuleBars counts={d.rule_counts} />
            <StatusDonut counts={d.status_counts} total={d.package_count} />
          </div>
          <div className="grid gap-4 @4xl:grid-cols-2">
            <AttentionPackages asOf={d.as_of} />
            <ApprovalHistory approvals={d.recent_approvals} />
          </div>
        </>
      )}
    </div>
  );
}
