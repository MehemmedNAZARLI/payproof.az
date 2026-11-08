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
 * Scroll offsets that keep `focus` (pane coordinates) over the same content point after the
 * content grows by `ratio`. `pad` is the unscaled padding around the content.
 */
export function zoomScroll(
  scroll: { left: number; top: number },
  focus: Point,
  ratio: number,
  pad = 12,
) {
  const keep = (offset: number, at: number) => Math.max(0, (offset + at - pad) * ratio + pad - at);
  return { left: keep(scroll.left, focus.x), top: keep(scroll.top, focus.y) };
}
