"use client";

import { type Schemas, subscribeEvents } from "@payproof/api-client";
import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { homeKeys } from "@/features/home/queries";
import { notificationKeys } from "@/features/notifications/queries";
import { packageDetailKeys } from "@/features/package-detail/queries";
import { packageKeys } from "@/features/packages/queries";

import { apiFetch } from "./api";
import { env } from "./env";
import { useOnline } from "./online";
import { endSession, getToken, hasStoredSession, useSession } from "./session";

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

// Fallback while the stream is down: active queries every 30 s (ADR-0010).
const POLL_MS = 30_000;

const listeners = new Set<(event: LiveEvent) => void>();

/** Listen to live events (toasts, the approval sheet's stale notice). Returns the unsubscribe. */
export function onLiveEvent(listener: (event: LiveEvent) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

const subscribeVisibility = (listener: () => void) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};
const useVisible = () =>
  useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );

/**
 * One SSE connection while signed in, online and in front (mounted once, in the providers).
 * Events invalidate what they change. Hidden or offline, the stream is closed — iOS drops
 * background connections anyway — and the next open refetches everything, since events may have
 * been missed meanwhile. While the stream is broken, active queries are polled every 30 s.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  const token = useSession()?.token;
  const online = useOnline();
  const visible = useVisible();
  // Outlives one connection (hidden, offline): whether the next open may follow missed events.
  const missed = useRef<{ token?: string; maybe: boolean }>({ maybe: false });

  useEffect(() => {
    if (!token || !online || !visible) return;
    if (missed.current.token !== token) missed.current = { token, maybe: false };
    const state = missed.current;
    let opened = false;
    let polling: ReturnType<typeof setInterval> | undefined;
    const stopPolling = () => {
      clearInterval(polling);
      polling = undefined;
    };
    const stop = subscribeEvents({
      baseUrl: env.apiUrl,
      getToken,
      fetch: apiFetch,
      onOpen: () => {
        opened = true;
        stopPolling();
        if (state.maybe) void queryClient.invalidateQueries();
        state.maybe = true;
      },
      onEvent: (event) => {
        const keys = liveInvalidation(event);
        if (keys === "all") void queryClient.invalidateQueries();
        else for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
        listeners.forEach((listener) => listener(event));
      },
      onError: (error) => {
        state.maybe = true;
        // The token was rejected (expired while idle): the stream stopped for good.
        if (error.status === 401) {
          if (hasStoredSession()) endSession("expired");
          return;
        }
        polling ??= setInterval(() => void queryClient.refetchQueries({ type: "active" }), POLL_MS);
      },
    });
    return () => {
      stop();
      stopPolling();
      if (opened) state.maybe = true;
    };
  }, [queryClient, token, online, visible]);
}
