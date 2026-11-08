"use client";

import { type RefObject, useEffect } from "react";

// How far a page without a large title scrolls before its bar turns opaque.
const COMPACT_RANGE = 8;

// 0 at the top → 1 once `range` px have scrolled under the bar.
export function collapseProgress(scrollY: number, range: number): number {
  const r = range > 0 ? range : COMPACT_RANGE;
  return Math.min(1, Math.max(0, scrollY / r));
}

// Writes the progress to `--p` on the header once per frame — no React re-render while scrolling.
export function useScrollCollapse(
  headerRef: RefObject<HTMLElement | null>,
  largeTitleRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const range = largeTitleRef.current?.offsetHeight ?? 0;
      header.style.setProperty("--p", String(collapseProgress(window.scrollY, range)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [headerRef, largeTitleRef]);
}
