"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { animateSpring, prefersReducedMotion } from "@/lib/spring";

// Keeps the sheet mounted through its exit animation and springs it between
// off-screen (its own height) and 0. Offsets are written to the DOM, not React state.
export function useSheetMotion(open: boolean) {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);

  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const offset = useRef(Number.POSITIVE_INFINITY);
  const velocity = useRef(0);
  const cancel = useRef(() => {});

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
    if (!present) return;
    const height = sheetRef.current?.offsetHeight ?? 0;
    if (open) {
      apply(Math.min(offset.current, height));
      animateTo(0);
    } else {
      animateTo(height, () => setPresent(false));
    }
    return () => cancel.current();
  }, [open, present, apply, animateTo]);

  return { present, sheetRef, backdropRef, offset, velocity, apply, animateTo };
}
