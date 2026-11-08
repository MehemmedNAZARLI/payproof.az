// Spring physics for gesture-driven motion (sheet drag and release).

export type Spring = { stiffness: number; damping: number; mass: number };
export type SpringState = { x: number; v: number };

// Damping ratio ≈ 0.95 and ~0.3 s response — the feel of a UIKit sheet presentation.
export const sheetSpring: Spring = { stiffness: 440, damping: 40, mass: 1 };

// Integrate in small steps so a dropped frame cannot make the spring explode.
const MAX_STEP = 1 / 240;
const REST_DISTANCE = 0.5;
const REST_VELOCITY = 8;

export function stepSpring(s: SpringState, target: number, dt: number, c: Spring): SpringState {
  let { x, v } = s;
  for (let left = dt; left > 0; left -= MAX_STEP) {
    const h = Math.min(MAX_STEP, left);
    const a = (-c.stiffness * (x - target) - c.damping * v) / c.mass;
    v += a * h;
    x += v * h;
  }
  return { x, v };
}

type AnimateOptions = {
  from: number;
  to: number;
  velocity?: number;
  spring?: Spring;
  onUpdate: (x: number) => void;
  onRest?: () => void;
};

// Drives a spring on animation frames; returns a cancel function.
export function animateSpring(o: AnimateOptions): () => void {
  let state: SpringState = { x: o.from, v: o.velocity ?? 0 };
  let last: number | undefined;
  let frame = requestAnimationFrame(function tick(now) {
    const dt = last === undefined ? 1 / 60 : Math.min((now - last) / 1000, 1 / 30);
    last = now;
    state = stepSpring(state, o.to, dt, o.spring ?? sheetSpring);
    if (Math.abs(state.x - o.to) < REST_DISTANCE && Math.abs(state.v) < REST_VELOCITY) {
      o.onUpdate(o.to);
      o.onRest?.();
      return;
    }
    o.onUpdate(state.x);
    frame = requestAnimationFrame(tick);
  });
  return () => cancelAnimationFrame(frame);
}

// UIScrollView-style resistance: the further past the edge, the less it moves; bounded by `limit`.
export function rubberband(offset: number, limit: number, c = 0.55): number {
  if (offset === 0) return 0;
  return (1 - 1 / ((Math.abs(offset) * c) / limit + 1)) * limit * Math.sign(offset);
}

const VELOCITY_WINDOW_MS = 100;

export function createVelocityTracker() {
  let samples: { t: number; y: number }[] = [];
  return {
    add(t: number, y: number) {
      samples = [...samples.filter((s) => t - s.t <= VELOCITY_WINDOW_MS), { t, y }];
    },
    /** px/s over the recent window; 0 if the pointer has rested. */
    velocity() {
      const first = samples[0];
      const last = samples.at(-1);
      if (!first || !last || last.t === first.t) return 0;
      return ((last.y - first.y) / (last.t - first.t)) * 1000;
    },
  };
}

// Where a flick would coast to (UIScrollView's normal deceleration rate).
const DECELERATION = 0.998;
const project = (velocity: number) => ((velocity / 1000) * DECELERATION) / (1 - DECELERATION);

export function shouldDismiss(offset: number, velocity: number, height: number): boolean {
  return offset + project(velocity) > height / 2;
}
