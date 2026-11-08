import { describe, expect, it } from "vitest";

import { MAX_SCALE, nextStep, pinchScale, toggleScale, zoomScrollDelta } from "./zoom";

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

describe("zoomScrollDelta", () => {
  it("keeps the point under the fingers in place on a page at the pane's edge", () => {
    // Page at (12, 12); a point 100px into it doubles to 200px, so scroll on by 100.
    expect(zoomScrollDelta({ x: 12, y: 12 }, { x: 12, y: 12 }, { x: 112, y: 112 }, 2)).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("accounts for a centred page that moves as it grows", () => {
    // A 640px page centred in an 824px pane starts at 92; at 2× it is wider than the pane
    // and starts at the padding (12). The tapped point 108px into the page must stay at x=200.
    expect(zoomScrollDelta({ x: 92, y: 12 }, { x: 12, y: 12 }, { x: 200, y: 50 }, 2).x).toBe(
      12 + 216 - 200,
    );
  });
});
