"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { AppHeader } from "@/components/ui/app-header";
import { Card, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { CountBadge } from "@/components/ui/icon-button";
import { ListGroup } from "@/components/ui/list";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useMe } from "@/features/auth/queries";
import { notificationKeys, useUnreadCount } from "@/features/notifications/queries";
import { PackageRow } from "@/features/packages/components/package-row";
import { packagesHref } from "@/features/packages/filters";
import { usePackages } from "@/features/packages/queries";
import { InstallCard } from "@/features/pwa/install-hint";
import { formatLongDate, greeting } from "@/lib/format";
import { t } from "@/lib/i18n";
import { refreshAll } from "@/lib/refresh";
import { useSession } from "@/lib/session";

import { useDashboard, useRecentActivity } from "../queries";
import { OpenAmounts, RecentActivity, SectionSkeleton } from "./home-sections";
import { ApprovalHero, StatusTiles, SummarySkeleton } from "./home-summary";
import { Section } from "./section";

const READY = { status: ["READY_FOR_APPROVAL" as const], limit: 20 };

export function HomeScreen() {
  // The session already carries the user, so the greeting never waits for the network.
  const session = useSession();
  const me = useMe().data ?? session?.user;
  const dashboard = useDashboard();
  const ready = usePackages(READY);
  const activity = useRecentActivity();
  const unread = useUnreadCount();
  const qc = useQueryClient();
  const notifications = { refetch: () => qc.refetchQueries({ queryKey: notificationKeys.all }) };
  const now = new Date();
  const firstName = me?.full_name.split(" ")[0];

  return (
    <PullToRefresh onRefresh={() => refreshAll([dashboard, ready, activity, notifications])}>
      <AppHeader
        large
        title={firstName ? `${greeting(now)}, ${firstName}` : greeting(now)}
        subtitle={[me?.company.name, formatLongDate(now)].filter(Boolean).join(" · ")}
        trailing={
          <Link
            href="/notifications"
            aria-label={unread ? t.common.notificationsUnread(unread) : t.nav.notifications}
            className="text-brand-600 relative grid size-11 place-items-center rounded-full transition-opacity active:opacity-50"
          >
            <Icon name="bell" size={24} />
            {unread > 0 && <CountBadge count={unread} className="absolute top-1 right-0.5" />}
          </Link>
        }
      />
      <main className="px-safe pb-tabbar pull-shift mx-auto max-w-app pt-2">
        {/* Loaded numbers stay on screen if a background refresh fails (a toast reports it). */}
        <Section query={dashboard} skeleton={<SummarySkeleton />}>
          {(data) => (
            <>
              <ApprovalHero
                dashboard={data}
                canApprove={me?.permissions.includes("APPROVE_PACKAGE") ?? false}
              />
              <StatusTiles counts={data.status_counts} />
              <SectionHeader title={t.home.openAmount} />
              <OpenAmounts amounts={data.open_problem_amounts} />
            </>
          )}
        </Section>

        <SectionHeader
          title={t.home.pending}
          action={
            <Link
              href={packagesHref("ready")}
              className="text-brand-600 flex min-h-11 items-center text-md font-medium active:opacity-50"
            >
              {t.home.all}
            </Link>
          }
        />
        <Section query={ready} skeleton={<SectionSkeleton rows={2} cards />}>
          {(page) =>
            page.items.length === 0 ? (
              <Card className="p-0">
                <EmptyState
                  icon="pass"
                  title={t.home.pendingEmpty}
                  description={t.home.pendingEmptyHint}
                />
              </Card>
            ) : (
              <ListGroup variant="cards" label={t.home.pending}>
                {page.items.map((p) => (
                  <PackageRow key={p.id} item={p} />
                ))}
              </ListGroup>
            )
          }
        </Section>

        <InstallCard />

        <SectionHeader title={t.home.activity} />
        <Section query={activity} skeleton={<SectionSkeleton rows={4} />}>
          {(page) => <RecentActivity events={page.items} />}
        </Section>
      </main>
    </PullToRefresh>
  );
}
