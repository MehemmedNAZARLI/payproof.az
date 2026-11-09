import { unwrap, type ApiError, type Schemas } from "@payproof/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { usePackageChangedSince } from "@/lib/stale";
import { dashboardKeys } from "@/features/dashboard";
import { packageKeys } from "@/features/packages";
import { api } from "@/lib/api";
import { packageMutationKey } from "./mutations";

/** Bound to what the user saw: the version and the rule set. One key per intent (dialog). */
interface Intent {
  expected_version: number;
  expected_requirement_set_version: number;
  idempotencyKey: string;
}

type Pkg = Schemas["PackageDetail"];
const bind = (pkg: Pkg) => ({
  version: pkg.version,
  ruleSet: pkg.requirement_set.version,
  key: crypto.randomUUID(), // one intent per bound version
});

/**
 * A dialog approves/exports the version the user looked at, not whatever the live query holds
 * now. `newer`: a later version exists (from the live stream, or already refetched) — the dialog
 * locks its action until the user rebinds, which refetches and starts a new intent (new key).
 */
export function useBoundVersion(pkg: Pkg) {
  const client = useQueryClient();
  const [seen, setSeen] = useState(() => bind(pkg));
  const live = usePackageChangedSince(pkg.id, seen.version);
  const moved = pkg.version !== seen.version || pkg.requirement_set.version !== seen.ruleSet;
  const rebind = async () => {
    await client.refetchQueries({ queryKey: packageKeys.detail(pkg.id) });
    const latest = client.getQueryData<Pkg>(packageKeys.detail(pkg.id)) ?? pkg;
    setSeen(bind(latest));
    return latest;
  };
  return { seen, newer: live ?? (moved ? pkg.version : null), rebind };
}

/**
 * Approve/export answer with a record, not the package: refetch it and everything listing it.
 * A 409 VERSION_CONFLICT is explained by the "Paket yenilənib" dialog, not a toast.
 */
function useApprovalMutation<T, V extends Intent>(id: string, request: (vars: V) => Promise<T>) {
  const client = useQueryClient();
  return useMutation<T, ApiError, V>({
    mutationKey: packageMutationKey(id),
    mutationFn: request,
    meta: { inlineErrors: ["VERSION_CONFLICT"] },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: packageKeys.all }),
        client.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]),
  });
}

/** "Ready to send" — not a payment approval. Approver only; the server checks the role. */
export const useApprove = (id: string) =>
  useApprovalMutation(id, ({ idempotencyKey, ...body }: Intent) =>
    unwrap(
      api.POST("/v1/packages/{package_id}/approve", {
        params: { path: { package_id: id }, header: { "Idempotency-Key": idempotencyKey } },
        body: { ...body, documents_reviewed: true },
      }),
    ),
  );

/** Exports the approved current version with the chosen documents (the invoice is mandatory). */
export const useExport = (id: string) =>
  useApprovalMutation(
    id,
    ({ idempotencyKey, ...body }: Intent & { document_version_ids: string[] }) =>
      unwrap(
        api.POST("/v1/packages/{package_id}/export", {
          params: { path: { package_id: id }, header: { "Idempotency-Key": idempotencyKey } },
          body,
        }),
      ),
  );

/** A fresh short-lived link to an existing export — no new export event. */
export const exportDownload = (exportId: string) =>
  unwrap(
    api.GET("/v1/exports/{export_id}/download", { params: { path: { export_id: exportId } } }),
  );

/** Internal validation report of the current version (never part of the customer package). */
export const internalReport = (id: string) =>
  unwrap(
    api.GET("/v1/packages/{package_id}/internal-report", { params: { path: { package_id: id } } }),
  );

// shared with the audit CSV; re-exported so this feature (and its test mocks) keep one import
export { saveFile } from "@/lib/download";
