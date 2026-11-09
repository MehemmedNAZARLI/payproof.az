import { unwrap } from "@payproof/api-client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
};

export const useDashboard = () =>
  useQuery({
    queryKey: dashboardKeys.all,
    queryFn: ({ signal }) => unwrap(api.GET("/v1/dashboard", { signal })),
  });
