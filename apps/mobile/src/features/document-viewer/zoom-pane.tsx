"use client";

import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { t } from "@/lib/i18n";

import { useZoomGestures } from "./use-zoom-gestures";
import { MAX_SCALE, nextStep, toggleScale, zoomScrollDelta } from "./zoom";

type Layout = { width: number; scale: number };
type ZoomPaneProps = {
  label: string;
  children: (layout: Layout) => ReactNode;
  /** Zoom to start at once the width is known (e.g. readable text around a citation). */
  initialScale?: (width: number) => number;
};
type Focus = { x: number; y: number };

/** A page's top-left corner in pane coordinates. */
function corner(pane: Element, page: Element): Focus {
  const p = pane.getBoundingClientRect();
  const r = page.getBoundingClientRect();
  return { x: r.left - p.left, y: r.top - p.top };
}

/** The page (`data-zoom-page`) under a point in the pane, else the nearest one above it. */
function pageAt(pane: Element, at: Focus): Element | undefined {
  const pages = [...pane.querySelectorAll("[data-zoom-page]")];
  return pages.filter((page) => corner(pane, page).y <= at.y).at(-1) ?? pages[0];
}

// A scrollable reading surface that fits pages to its width and zooms like Photos: pinch and
// double-tap keep the point under the fingers in place; the buttons zoom around the centre.
// While pinching, the content is only transformed; the new size is laid out once on release.
export function ZoomPane({ label, children, initialScale }: ZoomPaneProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const pending = useRef<{ focus: Focus; ratio: number; page: Element; before: Focus } | null>(
    null,
  );
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
    const page = pageAt(pane, at);
    if (page)
      pending.current = {
        focus: at,
        ratio: next / scaleRef.current,
        page,
        before: corner(pane, page),
      };
    scaleRef.current = next;
    setScale(next);
  }, []);

  // After the new size is laid out, scroll so the focus point has not moved.
  useLayoutEffect(() => {
    const pane = paneRef.current;
    const p = pending.current;
    if (!pane || !p) return;
    pending.current = null;
    if (!p.page.isConnected) return;
    const delta = zoomScrollDelta(p.before, corner(pane, p.page), p.focus, p.ratio);
    pane.scrollBy({ left: delta.x, top: delta.y });
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
          // aria-disabled, not disabled: a focused button that becomes disabled drops focus.
          aria-disabled={scale <= 1}
          onClick={() => zoomTo(nextStep(scale, -1))}
          className="grid size-11 place-items-center rounded-full active:opacity-50 aria-disabled:opacity-30"
        >
          <Icon name="minus" size={20} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          // The visible percentage leads the name (label in name), then what a tap does.
          aria-label={`${Math.round(scale * 100)}% · ${t.viewer.fit}`}
          onClick={() => zoomTo(1)}
          className="h-11 min-w-12 text-sm font-semibold tabular-nums active:opacity-50"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          aria-label={t.viewer.zoomIn}
          aria-disabled={scale >= MAX_SCALE}
          onClick={() => zoomTo(nextStep(scale, 1))}
          className="grid size-11 place-items-center rounded-full active:opacity-50 aria-disabled:opacity-30"
        >
          <Icon name="plus" size={20} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
