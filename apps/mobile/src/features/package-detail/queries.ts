import { useQuery } from "@tanstack/react-query";

import { packageKeys } from "@/features/packages/queries";
import { api, unwrap } from "@/lib/api";

export const packageDetailKeys = {
  // Under packageKeys.all, so refreshing the packages also refreshes an open detail.
  detail: (id: string) => [...packageKeys.all, "detail", id] as const,
  file: (versionId: string) => ["document-file", versionId] as const,
};

/** One package with its checks, documents and tasks (`GET /v1/packages/{id}`). */
export function usePackage(id: string) {
  return useQuery({
    queryKey: packageDetailKeys.detail(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/v1/packages/{package_id}", { params: { path: { package_id: id } }, signal }),
      ),
  });
}

// Signed links live five minutes; ask for a new one before the old one can run out.
const LINK_FRESH_MS = 4 * 60_000;

/** A short-lived link to one document version's file. */
export function useDocumentFile(versionId: string | null) {
  return useQuery({
    queryKey: packageDetailKeys.file(versionId ?? ""),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/v1/documents/versions/{version_id}/file", {
          params: { path: { version_id: versionId! } },
          signal,
        }),
      ),
    enabled: versionId !== null,
    staleTime: LINK_FRESH_MS,
    gcTime: LINK_FRESH_MS,
    refetchOnWindowFocus: false,
  });
}
