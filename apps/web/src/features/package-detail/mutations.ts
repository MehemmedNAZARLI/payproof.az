import { toFormData, unwrap, type ApiError, type Schemas } from "@payproof/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardKeys } from "@/features/dashboard";
import { packageKeys } from "@/features/packages";
import { taskKeys } from "@/features/tasks";
import { api } from "@/lib/api";

type Pkg = Schemas["PackageDetail"];
const path = (id: string) => ({ params: { path: { package_id: id } } });

/**
 * Shared shape of package mutations: the response is the re-validated package, written straight
 * into the detail cache; lists, dashboard and tasks are refreshed. A 409 (someone changed the
 * package meanwhile) refetches the detail; the global handler shows the message.
 */
export const packageMutationKey = (id: string) => ["package-mutation", id] as const;

function usePackageMutation<V>(id: string, request: (vars: V) => Promise<Pkg>) {
  const client = useQueryClient();
  return useMutation<Pkg, ApiError, V>({
    // one key per package: the page can tell that any change to it is in flight
    mutationKey: packageMutationKey(id),
    mutationFn: request,
    onSuccess: (pkg) => {
      client.setQueryData(packageKeys.detail(id), pkg);
      // lists and audit go stale; the detail was just written from the response, don't refetch it
      void client.invalidateQueries({
        queryKey: packageKeys.all,
        predicate: ({ queryKey }) => queryKey[1] !== "detail" || queryKey[2] !== id,
      });
      void client.invalidateQueries({ queryKey: dashboardKeys.all });
      void client.invalidateQueries({ queryKey: taskKeys.all });
    },
    onError: (error) => {
      if (error.status === 409) void client.invalidateQueries({ queryKey: packageKeys.detail(id) });
    },
  });
}

/** A human confirms the order link (an AI suggestion until then). */
export const useConfirmMatch = (id: string) =>
  usePackageMutation(id, (body: { order_id: string; expected_version: number }) =>
    unwrap(api.POST("/v1/packages/{package_id}/matches", { ...path(id), body })),
  );

/** R-008: a person saw the signature (visual presence only — not legal authentication). */
export const useReviewSignature = (id: string) =>
  usePackageMutation(id, (body: { expected_version: number }) =>
    unwrap(api.POST("/v1/packages/{package_id}/signature-review", { ...path(id), body })),
  );

/** Re-run the deterministic rule engine on the current version. */
export const useValidate = (id: string) =>
  usePackageMutation(id, (body: { expected_version: number }) =>
    unwrap(api.POST("/v1/packages/{package_id}/validate", { ...path(id), body })),
  );

/** Fix an extracted value from its source; the document itself does not change (reason is audited). */
export const useCorrectField = (id: string) =>
  usePackageMutation(
    id,
    ({
      fieldId,
      ...body
    }: {
      fieldId: string;
      value: string;
      reason: string;
      expected_version: number;
    }) =>
      unwrap(api.PATCH("/v1/fields/{field_id}", { params: { path: { field_id: fieldId } }, body })),
  );

/** Soft-deletes a never-approved package (kept for audit); the server decides what is deletable. */
export function useDeletePackage(id: string) {
  const client = useQueryClient();
  return useMutation<unknown, ApiError, { expected_version: number }>({
    mutationKey: packageMutationKey(id),
    mutationFn: ({ expected_version }) =>
      unwrap(
        api.DELETE("/v1/packages/{package_id}", {
          params: { path: { package_id: id }, query: { expected_version } },
        }),
      ),
    onSuccess: () => {
      client.removeQueries({ queryKey: packageKeys.detail(id) });
      void client.invalidateQueries({ queryKey: packageKeys.all });
      void client.invalidateQueries({ queryKey: dashboardKeys.all });
      void client.invalidateQueries({ queryKey: taskKeys.all }); // its open tasks go with it
    },
    onError: (error) => {
      if (error.status === 409) void client.invalidateQueries({ queryKey: packageKeys.detail(id) });
    },
  });
}

export interface UploadInput {
  type: Schemas["DocumentType"];
  file: File;
  expectedVersion: number;
  /** One key per user intent: a retried request must not create a second version. */
  idempotencyKey: string;
  /** Set when the package already has this document: the file becomes its next version. */
  documentId?: string;
}

/** Starts extraction; answers with a job to poll. 409: version conflict or DUPLICATE_FILE (no new version). */
export function useUploadDocument(id: string) {
  const client = useQueryClient();
  return useMutation<Schemas["JobAccepted"], ApiError, UploadInput>({
    mutationKey: packageMutationKey(id),
    mutationFn: (input) => uploadRequest(id, input),
    meta: { inlineErrors: ["DUPLICATE_FILE", "VERSION_CONFLICT"] }, // the dialog explains them
    onError: (error) => {
      if (error.code === "VERSION_CONFLICT")
        void client.invalidateQueries({ queryKey: packageKeys.detail(id) });
    },
  });
}

/** The multipart request behind useUploadDocument (exported for request-level tests). */
export function uploadRequest(
  id: string,
  { type, file, expectedVersion, idempotencyKey, documentId }: UploadInput,
) {
  const header = { "Idempotency-Key": idempotencyKey };
  return documentId
    ? unwrap(
        api.POST("/v1/documents/{document_id}/versions", {
          params: { path: { document_id: documentId }, header },
          body: { file, expected_version: expectedVersion },
          bodySerializer: toFormData,
        }),
      )
    : unwrap(
        api.POST("/v1/packages/{package_id}/documents", {
          params: { path: { package_id: id }, header },
          body: { type, file, expected_version: expectedVersion },
          bodySerializer: toFormData,
        }),
      );
}

const DONE = new Set(["SUCCEEDED", "FAILED"]);

/** Polls an extraction job until it succeeds or fails. */
export const useJob = (jobId: string | undefined, intervalMs = 800) =>
  useQuery({
    queryKey: ["jobs", jobId],
    enabled: Boolean(jobId),
    queryFn: ({ signal }) =>
      unwrap(api.GET("/v1/jobs/{job_id}", { params: { path: { job_id: jobId! } }, signal })),
    refetchInterval: (query) => (DONE.has(query.state.data?.status ?? "") ? false : intervalMs),
  });
