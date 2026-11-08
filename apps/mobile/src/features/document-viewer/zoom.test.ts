import { describe, expect, it } from "vitest";

import { MAX_SCALE, nextStep, pinchScale, toggleScale, zoomScroll } from "./zoom";

describe("zoom steps", () => {
  it("steps through fixed levels and stops at the ends", () => {
    expect(nextStep(1, 1)).toBe(1.5);
    expect(nextStep(1.7, 1)).toBe(2);
    expect(nextStep(MAX_SCALE, 1)).toBe(MAX_SCALE);
    expect(nextStep(2.2, -1)).toBe(2);
    expect(nextStep(1, -1)).toBe(1);
  });

  it("settles a pinch inside the limits", () => {
    expect(nextStep(0.6, 0)).toBe(1);
    expect(nextStep(2.345, 0)).toBe(2.35);
    expect(nextStep(9, 0)).toBe(MAX_SCALE);
  });

  it("stretches past the limits with resistance while the fingers are down", () => {
    expect(pinchScale(1, 2)).toBe(2);
    expect(pinchScale(1, 0.5)).toBeGreaterThan(0.8);
    expect(pinchScale(1, 0.5)).toBeLessThan(1);
    expect(pinchScale(4, 2)).toBeLessThan(5.3);
  });

  it("double-tap zooms in from fit and back out from anywhere else", () => {
    expect(toggleScale(1)).toBe(2.5);
    expect(toggleScale(1.5)).toBe(1);
  });
});

describe("zoomScroll", () => {
  it("keeps the focus point in place", () => {
    // A point 100px into the pane at scroll 0 lands at 100 * 2 = 200 of the content after 2×.
    expect(zoomScroll({ left: 0, top: 0 }, { x: 112, y: 112 }, 2, 12)).toEqual({
      left: 100,
      top: 100,
    });
    expect(zoomScroll({ left: 50, top: 0 }, { x: 12, y: 12 }, 0.5, 12)).toEqual({
      left: 25,
      top: 0,
    });
  });
});
