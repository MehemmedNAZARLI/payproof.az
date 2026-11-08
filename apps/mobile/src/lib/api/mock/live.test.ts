import packages from "@fixtures/packages.json";
import { beforeEach, describe, expect, it } from "vitest";

import { contractErrors } from "@/test/contract";

import { liveAuditLog } from "./audit";
import { dashboard } from "./dashboard";
import { livePackage } from "./live";
import { packageDetail } from "./package-detail";
import { addApproval, resetSessionDb } from "./session-db";
import { mockUuid } from "./store";

const id = mockUuid("package", packages.find((p) => p.invoice_number === "INV-1038")!.id);
const approve = () =>
  addApproval({
    id: "0193a000-0000-7000-8008-900000000001",
    packageId: id,
    packageVersion: livePackage(id)!.version,
    requirementSetVersion: packageDetail(id, "u2")!.requirement_set.version,
    approverSlug: "u2",
    approvedAt: "2026-11-08T07:00:00Z",
  });

describe("mock state after a session approval", () => {
  beforeEach(resetSessionDb);

  it("moves the package to APPROVED_READY everywhere", () => {
    const before = dashboard().status_counts;
    approve();
    expect(livePackage(id)).toMatchObject({ status: "APPROVED_READY", blocking: [] });
    const after = dashboard().status_counts;
    expect(after.READY_FOR_APPROVAL).toBe(before.READY_FOR_APPROVAL - 1);
    expect(after.APPROVED_READY).toBe(before.APPROVED_READY + 1);
    expect(dashboard().recent_approvals[0]).toMatchObject({
      package: { id },
      approved_at: "2026-11-08T07:00:00Z",
    });
  });

  it("binds the detail's current approval and permissions to it", () => {
    approve();
    const d = packageDetail(id, "u2")!;
    expect(contractErrors("PackageDetail", d)).toEqual([]);
    expect(d.status).toBe("APPROVED_READY");
    expect(d.current_approval).toMatchObject({ package_version: d.version, valid: true });
    expect(d.permissions).toMatchObject({ can_approve: false, can_export: true });
  });

  it("appends the approval to the audit log", () => {
    approve();
    expect(liveAuditLog()[0]).toMatchObject({
      action: "package.approved",
      package: { id, invoice_number: "INV-1038" },
    });
  });
});
