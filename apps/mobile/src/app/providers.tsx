"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { type ReactNode, useEffect } from "react";

// The service worker would serve stale bundles during development, so it only runs in builds.
const isDev = process.env.NODE_ENV === "development";

// `disable` only skips registering; a worker left by an earlier `next start` on this origin
// would still control the page, so dev removes it.
function useUnregisterInDev() {
  useEffect(() => {
    if (!isDev || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())));
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useUnregisterInDev();
  // No reload on reconnect (it would drop an open approval sheet) and no per-route HTML caching
  // until M-11 defines the offline policy; TanStack Query refetches on reconnect (M-02).
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={isDev}
      reloadOnOnline={false}
      cacheOnNavigation={false}
    >
      {children}
    </SerwistProvider>
  );
}
