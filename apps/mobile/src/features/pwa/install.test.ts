import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installKind, resetInstallForTests, useInstall } from "./install";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";

describe("installKind", () => {
  it("offers nothing once the app runs from the home screen", () => {
    expect(installKind({ standalone: true, canPrompt: true, ua: ANDROID })).toBe("none");
  });

  it("uses the browser's own install prompt where there is one", () => {
    expect(installKind({ standalone: false, canPrompt: true, ua: ANDROID })).toBe("prompt");
  });

  it("explains the Share sheet in iPhone Safari, which has no prompt", () => {
    expect(installKind({ standalone: false, canPrompt: false, ua: IPHONE_SAFARI })).toBe("ios");
  });

  it("recognises iPad Safari, which reports itself as a Mac", () => {
    const ipad =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
    expect(installKind({ standalone: false, canPrompt: false, ua: ipad, touchPoints: 5 })).toBe(
      "ios",
    );
    expect(installKind({ standalone: false, canPrompt: false, ua: ipad, touchPoints: 0 })).toBe(
      "none",
    );
  });

  it("gives no Safari steps inside in-app browsers, which cannot add to the home screen", () => {
    const instagram =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0";
    expect(installKind({ standalone: false, canPrompt: false, ua: instagram })).toBe("none");
  });

  it("stays quiet where adding is not possible (other iOS browsers before 16.4, desktop)", () => {
    expect(installKind({ standalone: false, canPrompt: false, ua: IPHONE_CHROME })).toBe("none");
    expect(installKind({ standalone: false, canPrompt: false, ua: ANDROID })).toBe("none");
  });
});

describe("useInstall", () => {
  beforeEach(() => {
    localStorage.clear();
    resetInstallForTests();
  });
  afterEach(() => vi.restoreAllMocks());

  it("captures the browser's prompt, shows it once and then hides the hint", async () => {
    const { result } = renderHook(() => useInstall());
    expect(result.current.kind).toBe("none");
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    act(() => void window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.kind).toBe("prompt");
    await act(() => result.current.install());
    expect(prompt).toHaveBeenCalledOnce();
    expect(result.current.kind).toBe("none");
  });

  it("remembers that the hint was dismissed", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE_SAFARI);
    const { result } = renderHook(() => useInstall());
    expect(result.current.hintDismissed).toBe(false);
    act(() => result.current.dismissHint());
    expect(result.current.hintDismissed).toBe(true);
    expect(renderHook(() => useInstall()).result.current.hintDismissed).toBe(true);
  });
});
