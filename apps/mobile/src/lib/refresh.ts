import { onlineManager } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast-store";

import { t } from "./i18n";

/**
 * A user-asked refresh (pull-to-refresh): refetches the screen's queries and resolves when all
 * have settled. Offline a refetch would wait for the network indefinitely, so the cached data
 * stays and a toast says why. Failed refetches report themselves (query-client.ts).
 */
export async function refreshAll(queries: { refetch: () => Promise<unknown> }[]) {
  if (!onlineManager.isOnline()) {
    toast.error(t.errors.offline, t.errors.offlineHint);
    return;
  }
  await Promise.allSettled(queries.map((q) => q.refetch()));
}
