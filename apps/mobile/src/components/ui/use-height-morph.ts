"use client";

import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/spring";

// iOS sheet curve: quick start, long soft landing.
const MORPH = "height 380ms cubic-bezier(0.32, 0.72, 0, 1)";

// When the sheet's page changes (`key`), morph the panel from its old height to the new one
// instead of jumping — the content swaps before paint, the frame follows smoothly.
export function useHeightMorph(panelRef: RefObject<HTMLElement | null>, key: string | undefined) {
  const last = useRef(0);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      last.current = panel.offsetHeight;
    });
    observer.observe(panel);
    return () => observer.disconnect();
  });

  // A closed sheet has no panel: the next opening starts from scratch, not the old height.
  useLayoutEffect(() => {
    if (!panelRef.current) last.current = 0;
  });

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const from = last.current;
    panel.style.height = "";
    const to = panel.offsetHeight;
    last.current = to;
    if (!from || Math.abs(from - to) < 2 || prefersReducedMotion()) return;
    panel.style.height = `${from}px`;
    void panel.offsetHeight; // commit the start height before transitioning
    panel.style.transition = MORPH;
    panel.style.height = `${to}px`;
    const done = () => {
      panel.style.transition = "";
      panel.style.height = "";
    };
    const onEnd = (e: TransitionEvent) => e.propertyName === "height" && done();
    panel.addEventListener("transitionend", onEnd);
    const fallback = setTimeout(done, 500);
    return () => {
      panel.removeEventListener("transitionend", onEnd);
      clearTimeout(fallback);
      done();
    };
  }, [panelRef, key]);
}

// The focused control (an evidence link, "Geri") leaves with the old page; move focus to the
// panel so the dialog keeps it, Tab stays trapped and VoiceOver reads the new page's title.
export function usePageFocus(panelRef: RefObject<HTMLElement | null>, key: string | undefined) {
  const previous = useRef(key);
  useLayoutEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
  }, [panelRef, key]);
}
