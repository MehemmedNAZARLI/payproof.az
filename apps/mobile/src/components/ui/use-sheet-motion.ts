"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { animateSpring, prefersReducedMotion } from "@/lib/spring";

// Keeps the sheet mounted through its exit animation and springs it between
// off-screen (its own height) and 0. Offsets are written to the DOM, not React state.
export type SheetMotion = ReturnType<typeof useSheetMotion>;

export function useSheetMotion(open: boolean) {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);

  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const offset = useRef(Number.POSITIVE_INFINITY);
  const velocity = useRef(0);
  const cancel = useRef(() => {});
  const isOpen = useRef(open);

  const apply = useCallback((y: number) => {
    offset.current = y;
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transform = `translate3d(0, ${y}px, 0)`;
    const progress = 1 - y / (sheet.offsetHeight || 1);
    if (backdropRef.current) {
      backdropRef.current.style.opacity = String(Math.min(1, Math.max(0, progress)));
    }
  }, []);

  const animateTo = useCallback(
    (to: number, onRest?: () => void) => {
      cancel.current();
      const v = velocity.current;
      velocity.current = 0;
      if (prefersReducedMotion()) {
        const frame = requestAnimationFrame(() => {
          apply(to);
          onRest?.();
        });
        cancel.current = () => cancelAnimationFrame(frame);
        return;
      }
      cancel.current = animateSpring({
        from: offset.current,
        to,
        velocity: v,
        onUpdate: apply,
        onRest,
      });
    },
    [apply],
  );

  useLayoutEffect(() => {
    isOpen.current = open;
    if (!present) return;
    const height = sheetRef.current?.offsetHeight ?? 0;
    if (open) {
      apply(Math.min(offset.current, height));
      animateTo(0);
    } else {
      animateTo(height, () => {
        offset.current = Number.POSITIVE_INFINITY; // next open starts fully off-screen
        setPresent(false);
      });
    }
    return () => cancel.current();
  }, [open, present, apply, animateTo]);

  const stop = useCallback(() => cancel.current(), []);
  // A drag hands its release velocity to whichever spring runs next (back to 0, or out).
  const carryVelocity = useCallback((v: number) => {
    velocity.current = v;
  }, []);

  // Read by gesture handlers: a closing sheet must not be grabbed back.
  const openNow = useCallback(() => isOpen.current, []);

  return { present, sheetRef, backdropRef, offset, apply, animateTo, stop, carryVelocity, openNow };
}
