import { unwrap } from "@payproof/api-client";
import { useQuery } from "@tanstack/react-query";
import { packageKeys } from "@/features/packages";
import { api } from "@/lib/api";

export const usePackage = (id: string) =>
  useQuery({
    queryKey: packageKeys.detail(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/v1/packages/{package_id}", { params: { path: { package_id: id } }, signal }),
      ),
  });

// shortcut: one page of up to 100 events (newest first); a "load more" can follow next_cursor later
export const usePackageAudit = (id: string) =>
  useQuery({
    queryKey: packageKeys.audit(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/v1/packages/{package_id}/audit", {
          params: { path: { package_id: id }, query: { limit: 100 } },
          signal,
        }),
      ),
    select: (page) => page.items,
  });

/** Short-lived (5 min) signed link to a document version's file. */
export const useDocumentFile = (versionId: string) =>
  useQuery({
    queryKey: ["documents", "file", versionId],
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/v1/documents/versions/{version_id}/file", {
          params: { path: { version_id: versionId } },
          signal,
        }),
      ),
    staleTime: 4 * 60_000, // refetch before the link expires
  });
