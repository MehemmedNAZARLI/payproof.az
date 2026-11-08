"use client";

import { useEffect } from "react";

import { TabBar } from "@/components/ui/tab-bar";

import { useUnreadCount } from "../queries";

// The installed app's icon carries the same count (Badging API; home-screen PWAs on iOS 16.4+,
// Chrome/Edge desktop). Where it is missing, the in-app badges still say it.
function useAppBadge(count: number) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    const update = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
    update?.catch(() => {
      // not permitted here (e.g. not installed): the in-app badges are enough
    });
  }, [count]);
}

/** The tab bar with the unread notification count, kept in step with the list. */
export function NotificationTabBar() {
  const count = useUnreadCount();
  useAppBadge(count);
  return <TabBar notificationCount={count} />;
}
