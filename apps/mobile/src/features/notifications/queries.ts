import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api";
import type { paths } from "@/lib/api/generated/schema";
import { useSession } from "@/lib/session";

type Page = paths["/v1/notifications"]["get"]["responses"]["200"]["content"]["application/json"];

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
};

// Polled while the app is in front, so badges catch up without a push channel (Push is P2).
const POLL_MS = 60_000;

function notificationsQuery() {
  return {
    queryKey: notificationKeys.list(),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      unwrap(api.GET("/v1/notifications", { params: { query: { limit: 100 } }, signal })),
    refetchInterval: POLL_MS,
  };
}

/** The signed-in user's notifications, newest first (`GET /v1/notifications`). */
export const useNotifications = () => useQuery(notificationsQuery());

/** Unread count for the badges; shares the list's cache, so both always agree. */
export function useUnreadCount(): number {
  const signedIn = Boolean(useSession());
  const query = useQuery({
    ...notificationsQuery(),
    enabled: signedIn,
    select: (page: Page) => page.unread_count,
  });
  return query.data ?? 0;
}

// Change the cached page at once; the server confirms on the next refetch. Remembers which items
// this change flipped, so a failure can undo exactly those and nothing a later read changed.
async function optimistic(qc: QueryClient, change: (page: Page) => Page) {
  await qc.cancelQueries({ queryKey: notificationKeys.list() });
  const before = qc.getQueryData<Page>(notificationKeys.list());
  if (!before) return { flipped: [] };
  const after = change(before);
  qc.setQueryData(notificationKeys.list(), after);
  const wasUnread = new Set(before.items.filter((n) => n.read_at === null).map((n) => n.id));
  const flipped = after.items.filter((n) => n.read_at !== null && wasUnread.has(n.id));
  return { flipped: flipped.map((n) => n.id) };
}

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export const readOneIn = (page: Page, id: string): Page => {
  const hit = page.items.find((n) => n.id === id && n.read_at === null);
  if (!hit) return page;
  return {
    ...page,
    items: page.items.map((n) => (n === hit ? { ...n, read_at: now() } : n)),
    unread_count: Math.max(0, page.unread_count - 1),
  };
};

/** Marks the given items unread again (a failed read's rollback); untouched if none apply. */
export const unreadAgainIn = (page: Page, ids: readonly string[]): Page => {
  const undo = new Set(ids);
  const hits = page.items.filter((n) => undo.has(n.id) && n.read_at !== null);
  if (hits.length === 0) return page;
  return {
    ...page,
    items: page.items.map((n) => (hits.includes(n) ? { ...n, read_at: null } : n)),
    unread_count: page.unread_count + hits.length,
  };
};

export const readAllIn = (page: Page): Page => ({
  ...page,
  items: page.items.map((n) => (n.read_at === null ? { ...n, read_at: now() } : n)),
  unread_count: 0,
});

function useReadMutation<V>(
  request: (v: V) => Promise<unknown>,
  change: (page: Page, v: V) => Page,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: request,
    onMutate: (v: V) => optimistic(qc, (page) => change(page, v)),
    onError: (_e, _v, ctx) => {
      if (!ctx?.flipped.length) return;
      qc.setQueryData<Page>(
        notificationKeys.list(),
        (page) => page && unreadAgainIn(page, ctx.flipped),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export const useMarkRead = () =>
  useReadMutation(
    (id: string) =>
      unwrap(
        api.POST("/v1/notifications/{notification_id}/read", {
          params: { path: { notification_id: id } },
        }),
      ),
    readOneIn,
  );

export const useMarkAllRead = () =>
  useReadMutation(() => unwrap(api.POST("/v1/notifications/read-all")), readAllIn);
