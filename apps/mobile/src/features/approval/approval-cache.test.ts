import { QueryClient } from "@tanstack/react-query";
import { beforeAll, describe, expect, it } from "vitest";

import { homeKeys } from "@/features/home/queries";
import { packageDetailKeys } from "@/features/package-detail/queries";
import { packageKeys } from "@/features/packages/queries";
import type { Schemas } from "@/lib/api";
import { unwrap } from "@/lib/api";
import { detailOf, mockClient } from "@/test/mock";

import { applyApproval, approvedDashboard, approvedPage } from "./approval-cache";

let packageList: Schemas["PackageListItem"][];
let item: Schemas["PackageListItem"];
let pkg: Schemas["PackageDetail"];
let dashboard: Schemas["Dashboard"];
let approval: Schemas["ApprovalRecord"];
beforeAll(async () => {
  packageList = (await unwrap(mockClient().GET("/v1/packages"))).items;
  item = packageList.find((p) => p.invoice_number === "INV-1038")!;
  pkg = await detailOf(item.id);
  dashboard = await unwrap(mockClient().GET("/v1/dashboard"));
  approval = {
    id: "0193a000-0000-7000-8008-900000000001",
    package_version: pkg.version,
    requirement_set_version: pkg.requirement_set.version,
    approver: pkg.owner,
    approved_at: "2026-11-08T07:00:00Z",
    valid: true,
    invalidated_reason: null,
    invalidated_at: null,
  };
});
const page = (items: Schemas["PackageListItem"][]) => ({
  items,
  next_cursor: null,
  total_count: items.length,
});

describe("approval cache", () => {
  it("drops the package from a list filtered to other statuses", () => {
    const ready = page(packageList.filter((p) => p.status === "READY_FOR_APPROVAL"));
    const next = approvedPage(ready, { status: ["READY_FOR_APPROVAL"] }, item.id, "x");
    expect(next.items.map((p) => p.id)).not.toContain(item.id);
    expect(next.total_count).toBe(ready.total_count - 1);
  });

  it("re-labels the package in an unfiltered list", () => {
    const next = approvedPage(page([...packageList]), {}, item.id, "2026-11-08T07:00:00Z");
    expect(next.items.find((p) => p.id === item.id)).toMatchObject({
      status: "APPROVED_READY",
      blocking: [],
      updated_at: "2026-11-08T07:00:00Z",
    });
  });

  it("moves one package between the dashboard counts and its amount out of 'ready'", () => {
    const d = dashboard;
    const next = approvedDashboard(d, item.total);
    expect(next.status_counts.READY_FOR_APPROVAL).toBe(d.status_counts.READY_FOR_APPROVAL - 1);
    expect(next.status_counts.APPROVED_READY).toBe(d.status_counts.APPROVED_READY + 1);
    const azn = (x: typeof d) => x.ready_amounts.find((a) => a.total.currency === "AZN");
    expect(azn(next)?.package_count ?? 0).toBe((azn(d)?.package_count ?? 0) - 1);
    expect(next.ready_amounts.every((a) => !a.total.amount.includes("-"))).toBe(true);
  });

  it("writes every cached view at once", async () => {
    const qc = new QueryClient();
    qc.setQueryData(packageDetailKeys.detail(item.id), pkg);
    qc.setQueryData(packageKeys.list({ status: ["READY_FOR_APPROVAL"], limit: 20 }), page([item]));
    qc.setQueryData(homeKeys.dashboard(), dashboard);
    await applyApproval(qc, pkg, approval);
    expect(
      qc.getQueryData<Schemas["PackageDetail"]>(packageDetailKeys.detail(item.id)),
    ).toMatchObject({
      status: "APPROVED_READY",
      current_approval: { id: approval.id },
      permissions: { can_approve: false },
    });
    expect(
      qc.getQueryData<Schemas["PackagePage"]>(
        packageKeys.list({ status: ["READY_FOR_APPROVAL"], limit: 20 }),
      )?.items,
    ).toEqual([]);
  });
});
