import type { Schemas } from "@payproof/api-client";
import { describe, expect, it } from "vitest";

import { authKeys } from "@/features/auth/queries";
import { homeKeys } from "@/features/home/queries";
import { notificationKeys } from "@/features/notifications/queries";
import { packageDetailKeys } from "@/features/package-detail/queries";
import { packageKeys } from "@/features/packages/queries";

import { liveInvalidation } from "./live";

const PKG = "0193a000-0000-7000-8002-000000001038";
const event = (type: string, package_id: string | null = PKG) =>
  ({
    event_id: "0193a000-0000-7000-800a-000000000001",
    company_id: "0193a000-0000-7000-8000-00000000c0a1",
    type,
    package_id,
    package_version: package_id ? 3 : null,
    actor_id: null,
    at: "2026-11-08T07:00:00Z",
  }) as Schemas["LiveEvent"];

describe("liveInvalidation", () => {
  it.each([
    "package.created",
    "package.updated",
    "package.approved",
    "package.exported",
    "package.deleted",
  ])("%s refreshes the lists, that package's detail, the home screen and its activity", (type) => {
    expect(liveInvalidation(event(type))).toEqual([
      packageKeys.lists(),
      packageDetailKeys.detail(PKG),
      homeKeys.dashboard(),
      homeKeys.activityAll(),
    ]);
  });

  it("refreshes every detail when a package event names no package", () => {
    expect(liveInvalidation(event("package.updated", null))).toContainEqual(packageKeys.all);
  });

  it("refreshes the package's detail (its open tasks) on a task change", () => {
    expect(liveInvalidation(event("task.changed"))).toEqual([
      packageDetailKeys.detail(PKG),
      homeKeys.activityAll(),
    ]);
  });

  it("refreshes the notification list, which also feeds the tab bar and bell counters", () => {
    expect(liveInvalidation(event("notification.created"))).toEqual([notificationKeys.all]);
  });

  it("re-reads every package after a customer rule change (the rules re-ran)", () => {
    expect(liveInvalidation(event("requirements.changed", null))).toEqual([
      packageKeys.all,
      homeKeys.dashboard(),
      homeKeys.activityAll(),
    ]);
  });

  it("refreshes everything for an event type this app does not know yet", () => {
    expect(liveInvalidation(event("invoice.teleported"))).toBe("all");
  });

  it("never touches the signed-in user (only a 401 does)", () => {
    const all = ["package.updated", "task.changed", "notification.created"].flatMap((t) => {
      const keys = liveInvalidation(event(t));
      return keys === "all" ? [] : keys;
    });
    expect(all).not.toContainEqual(authKeys.me());
  });
});
