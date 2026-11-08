"use client";

import { type RefObject, useEffect, useRef } from "react";

import { haptic } from "@/lib/haptics";
import {
  animateSpring,
  createVelocityTracker,
  prefersReducedMotion,
  type Spring,
} from "@/lib/spring";

import { HOLD_PX, intent, pullOffset, THRESHOLD_PX } from "./pull-model";

// Snappy, barely underdamped: the content settles like a scroll view letting go.
const release: Spring = { stiffness: 380, damping: 34, mass: 1 };
// A refresh that answers instantly still shows the spinner turning, so the pull reads as done.
const MIN_SPIN_MS = 450;

/**
 * Drives pull-to-refresh on `root` without re-rendering per frame: writes `--pull` (px),
 * `--pull-progress` (0–1) and `--pull-top` (the bar's bottom) and sets `data-pulling` while the
 * content is off its rest position. Returns a function that runs the refresh directly.
 */
export function usePullGesture(
  rootRef: RefObject<HTMLDivElement | null>,
  refresh: RefObject<() => Promise<unknown>>,
  setBusy: (busy: boolean) => void,
) {
  const runRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let start: { x: number; y: number } | null = null;
    let pulling = false;
    let armed = false;
    let busy = false;
    let offset = 0;
    let stopSpring = () => {};
    const tracker = createVelocityTracker();

    const set = (px: number) => {
      offset = px;
      root.style.setProperty("--pull", `${px}px`);
      root.style.setProperty("--pull-progress", String(Math.min(1, px / THRESHOLD_PX)));
    };
    const settle = (to: number, velocity = 0) => {
      stopSpring();
      const done = () => {
        if (to === 0) delete root.dataset.pulling;
      };
      if (prefersReducedMotion()) {
        set(to);
        done();
        return;
      }
      stopSpring = animateSpring({
        from: offset,
        to,
        velocity,
        spring: release,
        onUpdate: set,
        onRest: done,
      });
    };

    const run = async () => {
      if (busy) return;
      busy = true;
      setBusy(true);
      await Promise.allSettled([refresh.current(), new Promise((r) => setTimeout(r, MIN_SPIN_MS))]);
      busy = false;
      setBusy(false);
      if (!pulling && root.dataset.pulling !== undefined) settle(0);
    };
    runRef.current = run;

    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      start = null;
      if (busy || e.touches.length !== 1 || !touch || window.scrollY > 0) return;
      if ((e.target as Element | null)?.closest?.("[inert]")) return;
      start = { x: touch.clientX, y: touch.clientY };
    };

    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!pulling) {
        const next = intent({ dx, dy, scrollY: window.scrollY });
        if (next === "undecided") return;
        if (next === "ignore") {
          start = null;
          return;
        }
        pulling = true;
        armed = false;
        stopSpring();
        root.dataset.pulling = "";
        root.style.setProperty("--pull-top", `${headerBottom(root)}px`);
      }
      e.preventDefault(); // the page itself must not scroll or bounce under the finger
      const px = pullOffset(dy);
      set(px);
      tracker.add(e.timeStamp, px);
      if (!armed && px >= THRESHOLD_PX) {
        armed = true; // like UIRefreshControl: once armed it refreshes, even if pulled back
        haptic("tap");
        void run();
      }
    };

    const onEnd = () => {
      start = null;
      if (!pulling) return;
      pulling = false;
      settle(busy ? HOLD_PX : 0, tracker.velocity());
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", onEnd);
    return () => {
      stopSpring();
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
    };
  }, [rootRef, refresh, setBusy]);

  return () => runRef.current();
}

// The spinner sits in the gap the content leaves under the bar (offline strip included).
function headerBottom(root: HTMLElement) {
  const bar = root.querySelector("header");
  return bar ? bar.getBoundingClientRect().bottom - root.getBoundingClientRect().top : 0;
}
