import { describe, expect, it } from "vitest";

import { HOLD_PX, intent, pullOffset, THRESHOLD_PX } from "./pull-model";

describe("pull-to-refresh model", () => {
  it("follows the finger with growing resistance, never past its limit", () => {
    expect(pullOffset(0)).toBe(0);
    expect(pullOffset(-40)).toBe(0);
    const a = pullOffset(60);
    const b = pullOffset(120);
    expect(a).toBeGreaterThan(30);
    expect(a).toBeLessThan(60);
    expect(b - a).toBeLessThan(a); // the second 60px moves the content less than the first
    expect(pullOffset(5000)).toBeLessThan(220);
  });

  it("needs a deliberate pull to trigger, and holds the spinner below that point", () => {
    const fingerToTrigger = [...Array(400).keys()].find((d) => pullOffset(d) >= THRESHOLD_PX)!;
    expect(fingerToTrigger).toBeGreaterThan(90);
    expect(fingerToTrigger).toBeLessThan(160);
    expect(HOLD_PX).toBeLessThan(THRESHOLD_PX);
  });

  it("claims only a downward drag that starts at the top of the page", () => {
    expect(intent({ dx: 0, dy: 3, scrollY: 0 })).toBe("undecided");
    expect(intent({ dx: 2, dy: 12, scrollY: 0 })).toBe("pull");
    expect(intent({ dx: 0, dy: -12, scrollY: 0 })).toBe("ignore");
    expect(intent({ dx: 20, dy: 12, scrollY: 0 })).toBe("ignore");
    expect(intent({ dx: 0, dy: 12, scrollY: 4 })).toBe("ignore");
  });
});
