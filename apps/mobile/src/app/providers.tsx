"use client";

// Side effect: the browser install prompt fires once, early, and must be caught from the start.
import "@/features/pwa/install";

import { SerwistProvider } from "@serwist/turbopack/react";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";

import { Toaster } from "@/components/ui/toaster";
import { clearSeen } from "@/features/package-detail/seen-store";
import { UpdatePrompt } from "@/features/pwa/update-prompt";
import { useLiveUpdates } from "@/lib/live";
import { useLiveToasts } from "@/lib/live-toasts";
import { createQueryClient } from "@/lib/query-client";
import { clearPersistedQueries, persistQueries, restoreQueries } from "@/lib/query-persist";
import { clearRuntimeCaches } from "@/lib/runtime-caches";
import { getSession, watchUserChange } from "@/lib/session";

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

const currentUser = () => getSession()?.user.id;

// The last loaded data comes back after a relaunch (offline too); restored after hydration, so
// the server and first client render agree. Newer data already fetched is kept.
function useOfflineCache(queryClient: QueryClient) {
  useEffect(() => {
    restoreQueries(queryClient, currentUser());
    return persistQueries(queryClient, currentUser);
  }, [queryClient]);
}

// One live event stream for the whole signed-in app (ADR-0010): mounted here, not per layout, so
// moving between tabs and package screens keeps the connection.
function LiveUpdates() {
  useLiveUpdates();
  useLiveToasts();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  useUnregisterInDev();
  const [queryClient] = useState(createQueryClient);
  useOfflineCache(queryClient);
  // Whoever signed out or took over (here, in another tab, or by expiry), their data goes too.
  useEffect(
    () =>
      watchUserChange(() => {
        queryClient.clear();
        clearPersistedQueries();
        clearSeen();
        void clearRuntimeCaches();
      }),
    [queryClient],
  );
  // No reload on reconnect (it would drop an open approval sheet); TanStack Query refetches on
  // reconnect (M-02). Pages visited are cached by the worker's network-first defaults, so the
  // installed app reopens offline; the data comes from the offline read cache above.
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={isDev}
      reloadOnOnline={false}
      cacheOnNavigation={false}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <LiveUpdates />
      </QueryClientProvider>
      <Toaster />
      <UpdatePrompt />
    </SerwistProvider>
  );
}
