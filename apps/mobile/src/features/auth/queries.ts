import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

/** The signed-in user with role and permissions (`GET /v1/me`). */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: ({ signal }) => unwrap(api.GET("/v1/me", { signal })),
  });
}
