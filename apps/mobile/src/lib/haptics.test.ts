import { afterEach, describe, expect, it, vi } from "vitest";

import { haptic } from "./haptics";

describe("haptic", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("vibrates with the kind's pattern where the Vibration API exists", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate, userAgent: "Android" });
    haptic("success");
    expect(vibrate).toHaveBeenCalledWith([12, 60, 24]);
  });

  it("waits for the first tap: Chrome refuses (and logs) vibration before any activation", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", {
      vibrate,
      userAgent: "Android",
      userActivation: { hasBeenActive: false },
    });
    haptic("tap");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("does nothing elsewhere", () => {
    vi.stubGlobal("navigator", { userAgent: "Desktop" });
    expect(() => haptic("tap")).not.toThrow();
    expect(document.querySelector("input[switch]")).toBeNull();
  });
});
