import { ApiError } from "@payproof/api-client";
import { errorFallback } from "@payproof/api-client/i18n";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Every request goes through `api`, whose middleware turns failures into ApiError.
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError;
  }
}

// Toast id = error code: N queries failing together (e.g. offline on refocus) show one toast.
const showError = (error: unknown) =>
  error instanceof ApiError
    ? toast.error(error.message, { id: error.code })
    : toast.error(errorFallback.INTERNAL_ERROR, { id: "INTERNAL_ERROR" });

/** Client errors (4xx) won't change on retry; network and 5xx get two more tries. */
export const shouldRetry = (failureCount: number, error: unknown) =>
  failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500);

/**
 * Global error policy: 401 → onUnauthenticated (sign out + login screen); failed mutations and
 * background refetches → toast with the server's Azerbaijani message. A first-load query error is
 * left to the screen, which renders its own error state.
 */
const inline = (meta: Record<string, unknown> | undefined): unknown[] =>
  Array.isArray(meta?.inlineErrors) ? meta.inlineErrors : [];

export function makeQueryClient({ onUnauthenticated }: { onUnauthenticated: () => void }) {
  const handle = (error: unknown, notify: boolean) => {
    if (error instanceof ApiError && error.status === 401) onUnauthenticated();
    else if (notify) showError(error);
  };
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => handle(error, query.state.data !== undefined),
    }),
    mutationCache: new MutationCache({
      // a mutation may list error codes its own UI explains inline (meta.inlineErrors)
      onError: (error, _v, _c, mutation) =>
        handle(error, !(error instanceof ApiError && inline(mutation.meta).includes(error.code))),
    }),
    defaultOptions: { queries: { staleTime: 30_000, retry: shouldRetry } },
  });
}
