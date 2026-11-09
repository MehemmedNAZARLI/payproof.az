import type { Schemas } from "@payproof/api-client";
import { describe, expect, test } from "vitest";
import { customerKeys } from "@/features/customers";
import { dashboardKeys } from "@/features/dashboard";
import { notificationKeys } from "@/features/notifications";
import { packageKeys } from "@/features/packages";
import { taskKeys } from "@/features/tasks";
import { liveInvalidation } from "./live";

const PKG = "0193a000-0000-7000-8002-000000001042";
const event = (type: string, package_id: string | null = PKG): Schemas["LiveEvent"] => ({
  event_id: "0193a000-0000-7000-8009-000000000001",
  company_id: "0193a000-0000-7000-8000-00000000c0a1",
  type: type as Schemas["LiveEventType"],
  package_id,
  package_version: 5,
  actor_id: null,
  at: "2026-11-08T09:12:00Z",
});

describe("liveInvalidation (event → query keys)", () => {
  test.each([
    "package.created",
    "package.updated",
    "package.approved",
    "package.exported",
    "package.deleted",
  ])("%s → package lists and detail, dashboard, open task count", (type) => {
    expect(liveInvalidation(event(type))).toEqual([
      packageKeys.all,
      dashboardKeys.all,
      taskKeys.all,
    ]);
  });

  test("task.changed → tasks and the package it belongs to", () => {
    expect(liveInvalidation(event("task.changed"))).toEqual([
      taskKeys.all,
      packageKeys.detail(PKG),
      dashboardKeys.all,
    ]);
    expect(liveInvalidation(event("task.changed", null))).toEqual([
      taskKeys.all,
      dashboardKeys.all,
    ]);
  });

  test("notification.created → notifications only", () => {
    expect(liveInvalidation(event("notification.created", null))).toEqual([notificationKeys.all]);
  });

  test("requirements.changed → customers and every package (all may be re-validated)", () => {
    expect(liveInvalidation(event("requirements.changed", null))).toEqual([
      customerKeys.all,
      packageKeys.all,
      dashboardKeys.all,
    ]);
  });

  test("an unknown type invalidates everything", () => {
    expect(liveInvalidation(event("package.renamed"))).toBe("all");
  });
});
