// Zoom levels of the document viewer: 1 = page fitted to the screen width.

export const MAX_SCALE = 4;
const STEPS = [1, 1.5, 2, 3, MAX_SCALE];
const RESISTANCE = 0.3;
const clamp = (n: number) => Math.min(MAX_SCALE, Math.max(1, n));

/** The next button step up (1) or down (-1), or the settled value of a pinch (0). */
export function nextStep(scale: number, direction: -1 | 0 | 1): number {
  if (direction === 0) return Math.round(clamp(scale) * 100) / 100;
  if (direction > 0) return STEPS.find((s) => s > scale + 0.01) ?? MAX_SCALE;
  return [...STEPS].reverse().find((s) => s < scale - 0.01) ?? 1;
}

/** Scale under the fingers: free inside the limits, rubber-banded past them. */
export function pinchScale(base: number, ratio: number): number {
  const s = base * ratio;
  if (s < 1) return 1 - (1 - s) * RESISTANCE;
  if (s > MAX_SCALE) return MAX_SCALE + (s - MAX_SCALE) * RESISTANCE;
  return s;
}

export const toggleScale = (scale: number) => (scale > 1.01 ? 1 : 2.5);

type Point = { x: number; y: number };

/**
 * How far to scroll so the point under `focus` stays put when the page it lies on grows by
 * `ratio`. `before`/`after` are that page's top-left corner in pane coordinates before and
 * after the new size is laid out — measured, so centred pages and unscaled gaps between pages
 * are accounted for.
 */
export function zoomScrollDelta(before: Point, after: Point, focus: Point, ratio: number): Point {
  const keep = (b: number, a: number, f: number) => a + (f - b) * ratio - f;
  return { x: keep(before.x, after.x, focus.x), y: keep(before.y, after.y, focus.y) };
}
