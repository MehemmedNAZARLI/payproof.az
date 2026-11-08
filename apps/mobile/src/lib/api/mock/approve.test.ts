import packages from "@fixtures/packages.json";
import { beforeEach, describe, expect, it } from "vitest";

import { contractErrors } from "@/test/contract";

import { approve } from "./approve";
import { liveAuditLog } from "./audit";
import { packageDetail } from "./package-detail";
import { resetSessionDb, sessionApprovals } from "./session-db";
import { mockUuid } from "./store";

const idOf = (invoice: string) =>
  mockUuid("package", packages.find((p) => p.invoice_number === invoice)!.id);
const KEY = "6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b";
const OTHER_KEY = "6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3c";

function request(invoice: string, over: Record<string, unknown> = {}, userSlug = "u2", key = KEY) {
  const d = packageDetail(idOf(invoice), "u2")!;
  const body = {
    expected_version: d.version,
    expected_requirement_set_version: d.requirement_set.version,
    documents_reviewed: true,
    ...over,
  };
  return approve({ userSlug, packageId: d.id, key, body });
}

describe("mock approve", () => {
  beforeEach(resetSessionDb);

  it("approves a ready package once; a double tap replays the same approval", () => {
    const first = request("INV-1038");
    expect(first.status).toBe(200);
    if (first.status !== 200) return;
    expect(contractErrors("ApprovalRecord", first.approval)).toEqual([]);
    expect(first.approval).toMatchObject({ valid: true, approver: { role: "approver" } });
    const again = request("INV-1038");
    expect(again).toEqual(first);
    // Even a fresh key (a second intent) gets the existing approval, without a new event.
    expect(request("INV-1038", {}, "u2", OTHER_KEY)).toEqual(first);
    expect(sessionApprovals()).toHaveLength(1);
    expect(liveAuditLog().filter((e) => e.object_id === first.approval.id)).toHaveLength(1);
  });

  it("refuses an operator with 403 before anything else", () => {
    expect(request("INV-1038", { expected_version: 99 }, "u1")).toMatchObject({
      status: 403,
      error: { code: "FORBIDDEN" },
    });
  });

  it("answers an outdated version or rule set with 409 VERSION_CONFLICT", () => {
    const d = packageDetail(idOf("INV-1038"), "u2")!;
    expect(request("INV-1038", { expected_version: d.version + 1 })).toMatchObject({
      status: 409,
      error: { code: "VERSION_CONFLICT", details: { current_version: d.version } },
    });
    expect(
      request("INV-1038", { expected_requirement_set_version: d.requirement_set.version + 1 }),
    ).toMatchObject({ status: 409, error: { code: "VERSION_CONFLICT" } });
    expect(sessionApprovals()).toEqual([]);
  });

  it("refuses a blocked package with 409 PACKAGE_NOT_READY", () => {
    expect(request("INV-1042")).toMatchObject({
      status: 409,
      error: { code: "PACKAGE_NOT_READY", details: { status: "NEEDS_REVIEW" } },
    });
  });

  it("returns the existing approval of an approved package", () => {
    expect(request("INV-1035")).toMatchObject({ status: 200, approval: { valid: true } });
  });

  it("validates the key and the body", () => {
    expect(request("INV-1038", {}, "u2", "nope")).toMatchObject({ status: 422 });
    expect(request("INV-1038", { documents_reviewed: false })).toMatchObject({
      status: 422,
      error: { details: { field: "documents_reviewed" } },
    });
    expect(request("INV-1038", { extra: 1 })).toMatchObject({ status: 422 });
  });

  it("refuses a key reused for another package", () => {
    request("INV-1038");
    expect(request("INV-1045")).toMatchObject({
      status: 422,
      error: { code: "IDEMPOTENCY_KEY_REUSED" },
    });
  });
});
