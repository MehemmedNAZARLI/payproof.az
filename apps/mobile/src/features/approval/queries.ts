import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, ApiError, type Schemas, unwrap } from "@/lib/api";
import { errorMessage } from "@/lib/query-client";

import { applyApproval } from "./approval-cache";

type Detail = Schemas["PackageDetail"];
export type ApproveInput = { key: string; version: number; ruleSetVersion: number };

/**
 * Approve the version the user reviewed. The Idempotency-Key belongs to one intent: the caller
 * keeps it for retries of the same attempt, so a double tap or a retry after a lost response
 * never makes a second approval.
 */
export function useApprove(pkg: Detail) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, version, ruleSetVersion }: ApproveInput) =>
      unwrap(
        api.POST("/v1/packages/{package_id}/approve", {
          params: { path: { package_id: pkg.id }, header: { "Idempotency-Key": key } },
          body: {
            expected_version: version,
            expected_requirement_set_version: ruleSetVersion,
            documents_reviewed: true,
          },
        }),
      ),
    // The sheet explains every failure in place.
    meta: { silentError: true },
    // Never queue an approval for "when the connection is back": that would approve later than
    // the user saw. Offline, it fails now and the sheet says why.
    networkMode: "always",
    onSuccess: (approval) => applyApproval(qc, pkg, approval),
  });
}

export type ApprovalFailure =
  /** `version`: the package's current version, when the server said. */
  | { kind: "conflict"; version?: number }
  | { kind: "forbidden" }
  | { kind: "not-ready"; message: string }
  | { kind: "in-progress" }
  | { kind: "offline" }
  | { kind: "other"; message: string };

/** What went wrong, in terms of what the sheet does next. */
export function approvalFailure(error: unknown): ApprovalFailure {
  if (!(error instanceof ApiError)) return { kind: "other", message: "" };
  switch (error.code) {
    case "VERSION_CONFLICT": {
      const v = error.details.current_version;
      return typeof v === "number" ? { kind: "conflict", version: v } : { kind: "conflict" };
    }
    // The key was spent on a request for another version: the same as reviewing a stale one.
    case "IDEMPOTENCY_KEY_REUSED":
      return { kind: "conflict" };
    case "FORBIDDEN":
      return { kind: "forbidden" };
    case "PACKAGE_NOT_READY":
      return { kind: "not-ready", message: errorMessage(error) };
    case "IDEMPOTENCY_IN_PROGRESS":
      return { kind: "in-progress" };
    case "NETWORK_ERROR":
      return { kind: "offline" };
    default:
      return { kind: "other", message: errorMessage(error) };
  }
}
