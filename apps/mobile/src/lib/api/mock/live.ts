import type { Schemas } from "@payproof/api-client";

import { type SessionApproval, sessionApprovals } from "./session-db";
import { packageList, userRef } from "./store";

// The fixtures as they stand after this session's writes: an approval of a package's current
// version moves it to APPROVED_READY with nothing blocking, as the server's status machine does.

type Item = Schemas["PackageListItem"];

/** This session's valid approval of the package's current version, if any. */
export const sessionApprovalOf = (item: Pick<Item, "id" | "version">) =>
  sessionApprovals().find((a) => a.packageId === item.id && a.packageVersion === item.version);

function live(item: Item): Item {
  const approval = sessionApprovalOf(item);
  if (!approval || item.status !== "READY_FOR_APPROVAL") return item;
  return {
    ...item,
    status: "APPROVED_READY",
    blocking: [],
    problem_since: null,
    updated_at: approval.approvedAt > item.updated_at ? approval.approvedAt : item.updated_at,
  };
}

/** Every package with this session's approvals applied. */
export const livePackages = (): Item[] => packageList.map(live);

export const livePackage = (id: string) => livePackages().find((p) => p.id === id);

export function approvalRecord(a: SessionApproval): Schemas["ApprovalRecord"] {
  return {
    id: a.id,
    package_version: a.packageVersion,
    requirement_set_version: a.requirementSetVersion,
    approver: userRef(a.approverSlug),
    approved_at: a.approvedAt,
    valid: true,
    invalidated_reason: null,
    invalidated_at: null,
  };
}

/** Approval records made in this session for one package, oldest first. */
export const sessionApprovalRecords = (packageId: string) =>
  sessionApprovals()
    .filter((a) => a.packageId === packageId)
    .map(approvalRecord);
