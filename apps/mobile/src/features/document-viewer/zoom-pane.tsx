"use client";

import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { t } from "@/lib/i18n";

import { useZoomGestures } from "./use-zoom-gestures";
import { nextStep, toggleScale, zoomScroll } from "./zoom";

type Layout = { width: number; scale: number };
type ZoomPaneProps = {
  label: string;
  children: (layout: Layout) => ReactNode;
  /** Zoom to start at once the width is known (e.g. readable text around a citation). */
  initialScale?: (width: number) => number;
};
type Focus = { x: number; y: number };

// A scrollable reading surface that fits pages to its width and zooms like Photos: pinch and
// double-tap keep the point under the fingers in place; the buttons zoom around the centre.
// While pinching, the content is only transformed; the new size is laid out once on release.
export function ZoomPane({ label, children, initialScale }: ZoomPaneProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const pending = useRef<{ focus: Focus; ratio: number } | null>(null);
  // The starting zoom is chosen once, when the pane first appears.
  const initial = useRef(initialScale);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const measure = () => setWidth(pane.clientWidth);
    measure();
    const start = nextStep(initial.current?.(pane.clientWidth - 24) ?? 1, 0);
    scaleRef.current = start;
    setScale(start);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  /** Zoom to `next`, keeping `focus` (pane coordinates) where it is. */
  const zoomTo = useCallback((next: number, focus?: Focus) => {
    const pane = paneRef.current;
    if (!pane || next === scaleRef.current) return;
    const at = focus ?? { x: pane.clientWidth / 2, y: pane.clientHeight / 2 };
    pending.current = { focus: at, ratio: next / scaleRef.current };
    scaleRef.current = next;
    setScale(next);
  }, []);

  // After the new size is laid out, scroll so the focus point has not moved.
  useLayoutEffect(() => {
    const pane = paneRef.current;
    const p = pending.current;
    if (!pane || !p) return;
    pending.current = null;
    const scroll = zoomScroll({ left: pane.scrollLeft, top: pane.scrollTop }, p.focus, p.ratio);
    pane.scrollTo(scroll);
  }, [scale]);

  useZoomGestures(paneRef, contentRef, scaleRef, zoomTo);

  return (
    <div className="relative short:h-full">
      <div
        ref={paneRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        onDoubleClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          zoomTo(toggleScale(scaleRef.current), { x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        className="bg-surface-2 max-h-[calc(100dvh-var(--safe-top)-16rem)] touch-pan-x touch-pan-y overflow-auto overscroll-contain rounded-md short:h-full short:max-h-none"
      >
        <div ref={contentRef} className="w-max min-w-full p-3 will-change-transform">
          {width > 0 && children({ width: width - 24, scale })}
        </div>
      </div>
      <div className="material shadow-2 absolute right-2 bottom-2 flex items-center rounded-full">
        <button
          type="button"
          aria-label={t.viewer.zoomOut}
          disabled={scale <= 1}
          onClick={() => zoomTo(nextStep(scale, -1))}
          className="grid size-11 place-items-center rounded-full disabled:opacity-30 active:opacity-50"
        >
          <Icon name="minus" size={20} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          aria-label={t.viewer.fit}
          onClick={() => zoomTo(1)}
          className="h-11 min-w-12 text-sm font-semibold tabular-nums active:opacity-50"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          aria-label={t.viewer.zoomIn}
          disabled={scale >= 4}
          onClick={() => zoomTo(nextStep(scale, 1))}
          className="grid size-11 place-items-center rounded-full disabled:opacity-30 active:opacity-50"
        >
          <Icon name="plus" size={20} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
