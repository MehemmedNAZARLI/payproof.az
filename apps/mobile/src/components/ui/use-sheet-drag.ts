"use client";

import { type PointerEvent, useRef } from "react";

import { createVelocityTracker, rubberband, shouldDismiss } from "@/lib/spring";

import type { SheetMotion } from "./use-sheet-motion";

// Movement before a press becomes a drag, so taps on the close button still click.
const DRAG_SLOP = 4;
// How far the sheet may stretch upwards past its resting place.
const OVERDRAG_LIMIT = 64;

type Drag = {
  id: number;
  startY: number;
  startOffset: number;
  active: boolean;
  tracker: ReturnType<typeof createVelocityTracker>;
};

// Swipe-down on the handle area: follows the finger, then springs back or dismisses,
// carrying the release velocity into the spring.
export function useSheetDrag(motion: SheetMotion, onClose: () => void) {
  const drag = useRef<Drag | null>(null);

  const end = (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.active) return;
    const velocity = d.tracker.velocity();
    const height = motion.sheetRef.current?.offsetHeight ?? 0;
    motion.carryVelocity(velocity);
    if (!cancelled && shouldDismiss(motion.offset.current, velocity, height)) onClose();
    else motion.animateTo(0);
  };

  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (!e.isPrimary || e.button !== 0) return;
      const tracker = createVelocityTracker();
      tracker.add(e.timeStamp, e.clientY);
      const startOffset = Number.isFinite(motion.offset.current) ? motion.offset.current : 0;
      drag.current = { id: e.pointerId, startY: e.clientY, startOffset, active: false, tracker };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      const dy = e.clientY - d.startY;
      if (!d.active) {
        if (Math.abs(dy) < DRAG_SLOP) return;
        d.active = true;
        motion.stop();
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      d.tracker.add(e.timeStamp, e.clientY);
      const raw = d.startOffset + dy;
      motion.apply(raw < 0 ? rubberband(raw, OVERDRAG_LIMIT) : raw);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => end(e, false),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => end(e, true),
  };
}
