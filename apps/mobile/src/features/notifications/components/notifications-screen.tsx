"use client";

import { AppHeader } from "@/components/ui/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { ListSkeleton } from "@/components/ui/skeleton";
import { haptic } from "@/lib/haptics";
import { t } from "@/lib/i18n";
import { errorMessage } from "@/lib/query-client";
import { refreshAll } from "@/lib/refresh";

import { groupByDay } from "../group";
import { useMarkAllRead, useMarkRead, useNotifications } from "../queries";
import { NotificationRow } from "./notification-row";

export function NotificationsScreen() {
  const query = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const page = query.data;
  const unread = page?.unread_count ?? 0;

  return (
    <PullToRefresh onRefresh={() => refreshAll([query])}>
      <AppHeader
        large
        title={t.notifications.title}
        subtitle={page ? (unread ? t.common.unread(unread) : t.notifications.allRead) : undefined}
        trailing={
          unread > 0 && (
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                markAll.mutate(undefined);
              }}
              className="text-brand-600 min-h-11 px-2 text-md font-semibold active:opacity-50"
            >
              {t.notifications.readAll}
            </button>
          )
        }
      />
      <main className="px-safe pb-tabbar pull-shift mx-auto max-w-app pt-2">
        {page ? (
          page.items.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                icon="bell"
                title={t.notifications.emptyTitle}
                description={t.notifications.emptyBody}
              />
            </Card>
          ) : (
            groupByDay(page.items, new Date()).map((g) => (
              <section key={g.day} aria-labelledby={`day-${g.day}`}>
                <h2
                  id={`day-${g.day}`}
                  className="text-text-3 mt-5 mb-2 px-4 text-sm font-semibold first:mt-1"
                >
                  {g.heading}
                </h2>
                <ul className="bg-surface shadow-1 overflow-hidden rounded-lg">
                  {g.items.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      onOpen={() => n.read_at === null && markRead.mutate(n.id)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )
        ) : query.isError ? (
          <Card className="p-0">
            <EmptyState
              icon="alert"
              title={t.notifications.loadFailed}
              description={errorMessage(query.error)}
              action={
                <Button variant="secondary" onClick={() => void query.refetch()}>
                  {t.common.retry}
                </Button>
              }
            />
          </Card>
        ) : (
          <ListSkeleton rows={5} />
        )}
        <p className="text-text-3 mt-5 px-4 text-center text-sm text-pretty">
          {t.notifications.pushNote}
        </p>
      </main>
    </PullToRefresh>
  );
}
