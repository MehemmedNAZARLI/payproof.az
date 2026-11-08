"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";

// The service worker would serve stale bundles during development, so it only runs in builds.
const swDisabled = process.env.NODE_ENV === "development";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={swDisabled}>
      {children}
    </SerwistProvider>
  );
}
