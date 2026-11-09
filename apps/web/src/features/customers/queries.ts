import { unwrap, type ApiError, type Schemas } from "@payproof/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// files, not indexes: those features import this one
import { dashboardKeys } from "@/features/dashboard/queries";
import { packageKeys } from "@/features/packages/queries";
import { taskKeys } from "@/features/tasks/queries";
import { api } from "@/lib/api";

export const customerKeys = {
  all: ["customers"] as const,
  history: (id: string) => [...customerKeys.all, "history", id] as const,
};

export const useCustomers = () =>
  useQuery({
    queryKey: customerKeys.all,
    queryFn: ({ signal }) => unwrap(api.GET("/v1/customers", { signal })),
    select: (data) => data.items,
    staleTime: 5 * 60_000, // changes rarely (rule sets, W-15)
  });

/** Every rule set version of a customer, newest first (immutable history). */
export const useRequirementHistory = (customerId: string, enabled = true) =>
  useQuery({
    queryKey: customerKeys.history(customerId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/v1/customers/{customer_id}/requirements", {
          params: { path: { customer_id: customerId } },
          signal,
        }),
      ),
    select: (data) => data.items,
    enabled,
  });

export type NewRequirementSet = {
  require_po: boolean;
  require_delivery: boolean;
  require_signature: boolean;
  tolerance: string;
  effective_from: string;
  reason: string;
  expected_version: number;
};

/**
 * Approver only. A new version re-validates the customer's packages and voids their approvals,
 * so packages, the dashboard and tasks are refreshed too.
 */
export function useCreateRequirementSet(customerId: string) {
  const client = useQueryClient();
  return useMutation<Schemas["RequirementSet"], ApiError, NewRequirementSet>({
    mutationFn: (body) =>
      unwrap(
        api.POST("/v1/customers/{customer_id}/requirements", {
          params: { path: { customer_id: customerId } },
          body,
        }),
      ),
    onSettled: () =>
      Promise.all(
        [customerKeys.all, packageKeys.all, dashboardKeys.all, taskKeys.all].map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
