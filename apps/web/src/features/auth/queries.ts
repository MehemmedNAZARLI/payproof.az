import { unwrap, type Schemas } from "@payproof/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

// Query key factory: every auth key starts with authKeys.all, so one invalidate covers them all.
export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
  devUsers: () => [...authKeys.all, "dev-users"] as const,
};

export const useMe = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: authKeys.me(),
    enabled,
    queryFn: ({ signal }) => unwrap(api.GET("/v1/me", { signal })),
  });

/** Permissions come from the server (`GET /v1/me`); the UI never derives them from the role. */
export const useCan = (permission: Schemas["Permission"]) =>
  useMe().data?.permissions.includes(permission) ?? false;

export const useDevUsers = () =>
  useQuery({
    queryKey: authKeys.devUsers(),
    queryFn: ({ signal }) => unwrap(api.GET("/v1/auth/dev-users", { signal })),
    select: (data) => data.items,
  });

export function useDevLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(api.POST("/v1/auth/dev-login", { body: { user_id: userId } })),
    onSuccess: (session) => {
      setToken(session.access_token);
      queryClient.clear(); // nothing cached for the previous user may leak to this one
      queryClient.setQueryData(authKeys.me(), session.user);
    },
  });
}
