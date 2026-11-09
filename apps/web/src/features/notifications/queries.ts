import { unwrap } from "@payproof/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// live updates (W-05b) invalidate these on `notification.created`
export const notificationKeys = {
  all: ["notifications"] as const,
};

// shortcut: the latest 20 are enough for the popover; a full list page can follow next_cursor
export const useNotifications = () =>
  useQuery({
    queryKey: notificationKeys.all,
    queryFn: ({ signal }) =>
      unwrap(api.GET("/v1/notifications", { params: { query: { limit: 20 } }, signal })),
  });

function useNotificationMutation<V>(request: (vars: V) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/** Idempotent: reading a read notification again changes nothing. */
export const useMarkRead = () =>
  useNotificationMutation((id: string) =>
    unwrap(
      api.POST("/v1/notifications/{notification_id}/read", {
        params: { path: { notification_id: id } },
      }),
    ),
  );

export const useMarkAllRead = () =>
  useNotificationMutation(() => unwrap(api.POST("/v1/notifications/read-all")));
