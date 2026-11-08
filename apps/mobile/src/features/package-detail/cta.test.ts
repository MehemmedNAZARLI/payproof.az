import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api";

import { packageCta } from "./cta";

type Detail = Schemas["PackageDetail"];
const perms = (over: Partial<Detail["permissions"]> = {}): Detail["permissions"] => ({
  can_edit: false,
  can_manage_tasks: false,
  can_approve: false,
  can_export: false,
  can_delete: false,
  ...over,
});
const pkg = (
  status: Schemas["PackageStatus"],
  over: Partial<Pick<Detail, "permissions" | "summary" | "version">> = {},
) =>
  ({
    status,
    version: 2,
    permissions: perms(),
    summary: { pass: 0, fail: 0, unknown: 0, not_applicable: 0, blocking: [] },
    ...over,
  }) as Detail;

describe("packageCta", () => {
  it("offers approval only when the server says this user may approve", () => {
    expect(
      packageCta(pkg("READY_FOR_APPROVAL", { permissions: perms({ can_approve: true }) })),
    ).toEqual({
      kind: "approve",
    });
    expect(packageCta(pkg("READY_FOR_APPROVAL"))).toEqual({ kind: "awaiting-approver" });
  });

  it("names the primary blockers of a package that needs work", () => {
    const summary = {
      pass: 1,
      fail: 1,
      unknown: 4,
      not_applicable: 0,
      blocking: [
        { rule_id: "R-001", outcome: "FAIL" as const },
        { rule_id: "R-002", outcome: "UNKNOWN" as const },
      ],
    };
    expect(packageCta(pkg("NEEDS_FIX", { summary }))).toEqual({
      kind: "blocked",
      tone: "danger",
      rules: ["R-001", "R-002"],
    });
    expect(packageCta(pkg("NEEDS_REVIEW", { summary }))).toMatchObject({ tone: "warning" });
  });

  it("sends an approved package to the web for export, or says it is ready", () => {
    expect(packageCta(pkg("APPROVED_READY", { permissions: perms({ can_export: true }) }))).toEqual(
      {
        kind: "export-on-web",
      },
    );
    expect(packageCta(pkg("APPROVED_READY"))).toEqual({ kind: "ready" });
  });

  it("reports exported and processing packages without an action", () => {
    expect(packageCta(pkg("EXPORTED"))).toEqual({ kind: "exported", version: 2 });
    expect(packageCta(pkg("PROCESSING"))).toEqual({ kind: "processing" });
  });
});
