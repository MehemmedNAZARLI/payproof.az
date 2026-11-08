import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { api, unwrap } from "@/lib/api";
import { clearRuntimeCaches } from "@/lib/runtime-caches";
import { endSession, startSession } from "@/lib/session";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
  devUsers: () => [...authKeys.all, "dev-users"] as const,
};

/** The signed-in user with role and permissions (`GET /v1/me`). */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: ({ signal }) => unwrap(api.GET("/v1/me", { signal })),
  });
}

/** Demo accounts for the one-tap login (`GET /v1/auth/dev-users`, dev only). */
export function useDevUsers() {
  return useQuery({
    queryKey: authKeys.devUsers(),
    queryFn: ({ signal }) => unwrap(api.GET("/v1/auth/dev-users", { signal })),
    staleTime: Infinity,
  });
}

/** Signs in as a demo user and seeds `useMe` with the user the server returned. */
export function useDevLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(api.POST("/v1/auth/dev-login", { body: { user_id: userId } })),
    onSuccess(issued) {
      // A previous user's data must not survive into this session; the login's own list stays
      // so it does not flash back to a skeleton before the redirect.
      queryClient.removeQueries({
        predicate: ({ queryKey }) => queryKey.join() !== authKeys.devUsers().join(),
      });
      startSession(issued);
      queryClient.setQueryData(authKeys.me(), issued.user);
    },
  });
}

/**
 * Signs out: forgets the token, then everything fetched with it — the Query cache and the
 * service worker's runtime caches — so the next person on this device starts clean.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    endSession("user");
    queryClient.clear();
    await clearRuntimeCaches();
  }, [queryClient]);
}
