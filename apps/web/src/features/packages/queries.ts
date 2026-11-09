import { unwrap } from "@payproof/api-client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ListParams } from "./url";

export const PAGE_SIZE = 20;

export const packageKeys = {
  all: ["packages"] as const,
  list: (params: ListParams) => [...packageKeys.all, "list", params] as const,
  detail: (id: string) => [...packageKeys.all, "detail", id] as const,
  audit: (id: string) => [...packageKeys.all, "audit", id] as const,
};

const ATTENTION: ListParams = {
  status: ["NEEDS_FIX", "NEEDS_REVIEW"],
  sort: "-problem_age",
  limit: 5,
};

/** Overview: open problems that have waited longest. */
export const useAttentionPackages = () =>
  useQuery({
    queryKey: packageKeys.list(ATTENTION),
    queryFn: ({ signal }) =>
      unwrap(api.GET("/v1/packages", { params: { query: ATTENTION }, signal })),
    select: (page) => page.items,
  });

/** The package list for the given URL filters; the previous page stays visible while the next loads. */
export const usePackageList = (params: ListParams) => {
  const query = { limit: PAGE_SIZE, ...params };
  return useQuery({
    queryKey: packageKeys.list(query),
    queryFn: ({ signal }) => unwrap(api.GET("/v1/packages", { params: { query }, signal })),
    placeholderData: keepPreviousData,
  });
};
