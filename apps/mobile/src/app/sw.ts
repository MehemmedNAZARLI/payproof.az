import { defaultCache } from "@serwist/turbopack/worker";
import { NetworkOnly, type PrecacheEntry, Serwist, type SerwistGlobalConfig } from "serwist";

import { isPrivateRequest } from "../lib/sw-policy";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// App shell precache + Next.js default caching for same-origin assets/pages.
// A new deploy waits until the user accepts the update prompt (features/pwa), which posts
// SKIP_WAITING — Serwist listens for it when skipWaiting is off. clientsClaim lets the very first
// install control the page it was installed from.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  // First match wins: private requests bypass the cache before the defaults see them.
  runtimeCaching: [{ matcher: isPrivateRequest, handler: new NetworkOnly() }, ...defaultCache],
});

serwist.addEventListeners();
