import { ApiError } from "@payproof/api-client";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast-store";

import { errorMessages } from "./english";
import { t } from "./i18n";
import { endSession, hasStoredSession } from "./session";

// Fresh for 30 s; after that, returning to the app (focus) or reconnecting refetches.
const STALE_MS = 30_000;
// Keep what was viewed for the whole session, so it is still shown while offline.
const GC_MS = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 2;

declare module "@tanstack/react-query" {
  interface Register {
    defaultError: Error;
    /** `silentError`: the screen handles this mutation's error itself (e.g. 409 on approve). */
    mutationMeta: { silentError?: boolean };
  }
}

export const errorMessage = (error: unknown) =>
  error instanceof ApiError ? (errorMessages[error.code] ?? t.errors.unexpected) : t.errors.unexpected;

// 4xx will not get better by asking again; network and 5xx errors are worth a retry.
export const shouldRetry = (failures: number, error: unknown) =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
  failures < MAX_RETRIES;

// A rejected token (expired ones included) ends the session; the route guard then sends the user
// to the login, which says why, and back. Several requests usually fail together: one ends it.
function onUnauthenticated(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 401) return false;
  if (hasStoredSession()) endSession("expired");
  return true;
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      // A first load shows its error in place; a failed refresh keeps the data and says so.
      onError(error, query) {
        if (onUnauthenticated(error)) return;
        if (query.state.data !== undefined)
          toast.error(t.errors.refreshFailed, errorMessage(error));
      },
    }),
    mutationCache: new MutationCache({
      onError(error, _variables, _result, mutation) {
        if (onUnauthenticated(error)) return;
        if (!mutation.meta?.silentError) toast.error(errorMessage(error));
      },
    }),
    defaultOptions: {
      // networkMode "online" (default): offline, queries pause and keep showing cached data.
      queries: {
        staleTime: STALE_MS,
        gcTime: GC_MS,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: shouldRetry,
      },
      mutations: { retry: false },
    },
  });
}
