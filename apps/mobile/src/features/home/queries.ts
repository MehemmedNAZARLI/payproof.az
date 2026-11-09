import { useQuery } from "@tanstack/react-query";

import { api, ApiError, type Schemas, unwrap } from "@/lib/api";
import { t } from "@/lib/i18n";

export const homeKeys = {
  dashboard: () => ["dashboard"] as const,
  activityAll: () => ["audit"] as const,
  activity: (limit: number) => [...homeKeys.activityAll(), "recent", limit] as const,
};

/** KPIs for the home screen and the list chips (`GET /v1/dashboard`). */
export function useDashboard() {
  return useQuery({
    queryKey: homeKeys.dashboard(),
    queryFn: ({ signal }) => unwrap(api.GET("/v1/dashboard", { signal })),
  });
}

// The audit endpoint can also answer CSV; this screen only asks for JSON.
function asPage(body: Schemas["AuditPage"] | string): Schemas["AuditPage"] {
  if (typeof body === "string") throw new ApiError("INTERNAL_ERROR", t.errors.unexpected, 200);
  return body;
}

/** The latest company events (`GET /v1/audit`). */
export function useRecentActivity(limit = 4) {
  return useQuery({
    queryKey: homeKeys.activity(limit),
    queryFn: async ({ signal }) =>
      asPage(await unwrap(api.GET("/v1/audit", { params: { query: { limit } }, signal }))),
  });
}
