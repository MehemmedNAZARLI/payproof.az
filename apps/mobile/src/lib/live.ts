"use client";

import type { Schemas } from "@payproof/api-client";
import type { QueryKey } from "@tanstack/react-query";

import { homeKeys } from "@/features/home/queries";
import { notificationKeys } from "@/features/notifications/queries";
import { packageDetailKeys } from "@/features/package-detail/queries";
import { packageKeys } from "@/features/packages/queries";

export type LiveEvent = Schemas["LiveEvent"];

/**
 * What a live event makes stale on mobile (ADR-0010). Events carry IDs only: the data is
 * refetched over REST with the viewer's own permissions. `"all"` for types this app doesn't know.
 */
export function liveInvalidation(event: LiveEvent): QueryKey[] | "all" {
  const detail = event.package_id ? packageDetailKeys.detail(event.package_id) : packageKeys.all;
  switch (event.type) {
    case "package.created":
    case "package.updated":
    case "package.approved":
    case "package.exported":
    case "package.deleted":
      // status counts and amounts feed the home screen; every change is an audit row
      return [packageKeys.lists(), detail, homeKeys.dashboard(), homeKeys.activityAll()];
    case "task.changed":
      // tasks are shown inside the detail; a task status change is not a package status change
      return [detail, homeKeys.activityAll()];
    case "notification.created":
      // one query feeds the list, the tab bar badge, the bell and the app icon badge
      return [notificationKeys.all];
    case "requirements.changed":
      return [packageKeys.all, homeKeys.dashboard(), homeKeys.activityAll()];
    default:
      return "all";
  }
}
