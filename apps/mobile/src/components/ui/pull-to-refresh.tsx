"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { t } from "@/lib/i18n";

import { PullSpinner } from "./pull-spinner";
import { usePullGesture } from "./use-pull-gesture";

type Props = { onRefresh: () => Promise<unknown>; children: ReactNode };

/**
 * iOS-style pull-to-refresh for a tab screen. Pulling down at the top moves the large title and
 * the content (`.pull-shift`) with rubber-band resistance; past the threshold a haptic tick arms
 * it, the content springs back to hold the spinner while `onRefresh` runs, then springs home.
 * The bar stays put. Touch only; a focusable "Məlumatı yenilə" covers keyboards and screen readers.
 */
export function PullToRefresh({ onRefresh, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useRef(onRefresh);
  useEffect(() => {
    refresh.current = onRefresh;
  });
  const run = usePullGesture(rootRef, refresh, setBusy);

  return (
    <div ref={rootRef} data-testid="ptr" data-busy={busy} className="relative">
      <p role="status" className="sr-only">
        {busy ? t.common.refreshing : ""}
      </p>
      <button
        type="button"
        onClick={() => void run()}
        className="bg-surface text-accent shadow-2 sr-only top-[calc(var(--safe-top)+var(--sp-2))] left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-footnote font-semibold focus-visible:not-sr-only focus-visible:fixed"
      >
        {t.common.refreshData}
      </button>
      <PullSpinner spinning={busy} />
      {children}
    </div>
  );
}
