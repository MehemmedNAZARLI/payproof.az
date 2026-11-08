import { rubberband } from "@/lib/spring";

// Geometry of pull-to-refresh, in px of content movement (not finger travel).
/** Pulling the content this far starts a refresh (with a haptic tick). */
export const THRESHOLD_PX = 72;
/** Where the content rests while the spinner turns. */
export const HOLD_PX = 56;
// The furthest the content can go however far the finger travels (UIScrollView-like resistance).
const LIMIT_PX = 200;
// Finger travel before the gesture commits either way: smaller moves are taps or jitter.
const SLOP_PX = 8;

export const pullOffset = (fingerDy: number) => rubberband(Math.max(0, fingerDy), LIMIT_PX, 0.9);

/** Whether a touch that started at the top of the page is a pull, a scroll/swipe, or not yet known. */
export function intent(o: { dx: number; dy: number; scrollY: number }) {
  if (Math.abs(o.dx) < SLOP_PX && Math.abs(o.dy) < SLOP_PX) return "undecided";
  if (o.scrollY > 0 || o.dy <= 0 || Math.abs(o.dx) > Math.abs(o.dy)) return "ignore";
  return "pull";
}
