"use client";

import { type RefObject, useEffect } from "react";

import { nextStep, pinchScale, toggleScale } from "./zoom";

type Focus = { x: number; y: number };
type ZoomTo = (scale: number, focus?: Focus) => void;

const distance = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 30;

// Pinch, double-tap and trackpad zoom on the pane. Touch events (not pointer events): iOS hands
// a two-finger gesture to the page unless touchmove is cancelled, which needs passive: false.
// While pinching, the content is only transformed around the fingers; release commits a zoom.
export function useZoomGestures(
  paneRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  scaleRef: RefObject<number>,
  zoomTo: ZoomTo,
) {
  useEffect(() => {
    const pane = paneRef.current;
    const content = contentRef.current;
    if (!pane || !content) return;
    let pinch: { start: number; focus: Focus; ratio: number } | null = null;
    let lastTap: { time: number; x: number; y: number } | null = null;
    let moved = false;
    const local = (x: number, y: number) => {
      const r = pane.getBoundingClientRect();
      return { x: x - r.left, y: y - r.top };
    };
    const onStart = (e: TouchEvent) => {
      moved = false;
      if (e.touches.length !== 2) return;
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      const focus = local((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      pinch = { start: distance(a, b), focus, ratio: 1 };
      content.style.transformOrigin = `${pane.scrollLeft + focus.x - content.offsetLeft}px ${pane.scrollTop + focus.y - content.offsetTop}px`;
    };
    const onMove = (e: TouchEvent) => {
      moved = true;
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault(); // our pinch, not the page's
      const live = pinchScale(
        scaleRef.current,
        distance(e.touches[0]!, e.touches[1]!) / pinch.start,
      );
      pinch.ratio = live / scaleRef.current;
      content.style.transform = `scale(${pinch.ratio})`;
    };
    const onEnd = (e: TouchEvent) => {
      if (pinch && e.touches.length < 2) {
        const { focus, ratio } = pinch;
        pinch = null;
        content.style.transform = "";
        zoomTo(nextStep(scaleRef.current * ratio, 0), focus);
        return;
      }
      const touch = e.changedTouches[0];
      if (moved || e.touches.length > 0 || !touch) return;
      const now = e.timeStamp;
      const tap = { time: now, x: touch.clientX, y: touch.clientY };
      if (
        lastTap &&
        now - lastTap.time < DOUBLE_TAP_MS &&
        Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < DOUBLE_TAP_SLOP
      ) {
        e.preventDefault();
        lastTap = null;
        zoomTo(toggleScale(scaleRef.current), local(tap.x, tap.y));
      } else lastTap = tap;
    };
    // Trackpad pinch arrives as ctrl + wheel.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomTo(
        nextStep(scaleRef.current * Math.exp(-e.deltaY * 0.01), 0),
        local(e.clientX, e.clientY),
      );
    };
    pane.addEventListener("touchstart", onStart, { passive: true });
    pane.addEventListener("touchmove", onMove, { passive: false });
    pane.addEventListener("touchend", onEnd, { passive: false });
    pane.addEventListener("touchcancel", onEnd, { passive: false });
    pane.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      pane.removeEventListener("touchstart", onStart);
      pane.removeEventListener("touchmove", onMove);
      pane.removeEventListener("touchend", onEnd);
      pane.removeEventListener("touchcancel", onEnd);
      pane.removeEventListener("wheel", onWheel);
    };
  }, [paneRef, contentRef, scaleRef, zoomTo]);
}
