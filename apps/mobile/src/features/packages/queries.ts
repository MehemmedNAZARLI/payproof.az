import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, type PackageListQuery, unwrap } from "@/lib/api";

export const packageKeys = {
  all: ["packages"] as const,
  lists: () => [...packageKeys.all, "list"] as const,
  list: (query: PackageListQuery = {}) => [...packageKeys.lists(), query] as const,
};

/** One page of packages for the given filters (`GET /v1/packages`). */
export function usePackages(query: PackageListQuery = {}) {
  return useQuery({
    queryKey: packageKeys.list(query),
    queryFn: ({ signal }) => unwrap(api.GET("/v1/packages", { params: { query }, signal })),
    // Switching filters keeps the current rows until the new page arrives (no skeleton flash).
    placeholderData: keepPreviousData,
  });
}
