import { describe, expect, it } from "vitest";

import {
  createVelocityTracker,
  rubberband,
  sheetSpring,
  shouldDismiss,
  stepSpring,
} from "./spring";

const run = (from: number, to: number, seconds: number, v = 0) => {
  let s = { x: from, v };
  const path: number[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    s = stepSpring(s, to, 1 / 60, sheetSpring);
    path.push(s.x);
  }
  return { s, path };
};

describe("stepSpring", () => {
  it("settles on the target within half a second", () => {
    const { s } = run(600, 0, 0.5);
    expect(Math.abs(s.x)).toBeLessThan(1);
    expect(Math.abs(s.v)).toBeLessThan(20);
  });

  it("is close to critically damped: no visible overshoot", () => {
    const { path } = run(600, 0, 1);
    expect(Math.min(...path)).toBeGreaterThan(-600 * 0.01);
  });

  it("carries the release velocity before returning", () => {
    const { path } = run(0, 0, 1, 1500);
    expect(Math.max(...path)).toBeGreaterThan(20);
    expect(Math.abs(path.at(-1) ?? 1)).toBeLessThan(1);
  });

  it("stays stable when a frame takes much longer than usual", () => {
    const s = stepSpring({ x: 600, v: 0 }, 0, 0.5, sheetSpring);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Math.abs(s.x)).toBeLessThan(600);
  });
});

describe("rubberband", () => {
  it("resists more the further it is pulled and never passes the limit", () => {
    expect(rubberband(0, 400)).toBe(0);
    const a = rubberband(-50, 400);
    const b = rubberband(-200, 400);
    expect(a).toBeLessThan(0);
    expect(b).toBeLessThan(a);
    expect(Math.abs(b)).toBeLessThan(200);
    expect(Math.abs(rubberband(-1e6, 400))).toBeLessThan(400);
  });
});

describe("createVelocityTracker", () => {
  it("measures recent pointer speed in px/s", () => {
    const tracker = createVelocityTracker();
    for (let t = 0; t <= 80; t += 16) tracker.add(t, t);
    expect(tracker.velocity()).toBeCloseTo(1000, 0);
  });

  it("ignores samples older than its window (a pause before release)", () => {
    const tracker = createVelocityTracker();
    tracker.add(0, 0);
    tracker.add(16, 30);
    tracker.add(400, 30);
    tracker.add(416, 30);
    expect(tracker.velocity()).toBe(0);
  });
});

describe("shouldDismiss", () => {
  const height = 600;
  it("keeps the sheet for a short, slow drag", () => {
    expect(shouldDismiss(80, 50, height)).toBe(false);
  });
  it("dismisses after a slow drag past half the height", () => {
    expect(shouldDismiss(320, 0, height)).toBe(true);
  });
  it("dismisses on a quick downward flick", () => {
    expect(shouldDismiss(60, 1400, height)).toBe(true);
  });
  it("keeps the sheet when flicked back up", () => {
    expect(shouldDismiss(350, -1200, height)).toBe(false);
  });
});
