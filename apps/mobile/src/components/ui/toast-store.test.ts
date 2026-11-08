import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast, useToasts } from "./toast-store";

describe("toast store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    act(() => vi.runAllTimers());
    vi.useRealTimers();
  });

  it("adds a toast and removes it after its duration and exit animation", () => {
    const { result } = renderHook(() => useToasts());
    act(() => void toast.info("Siyahı yeniləndi."));
    expect(result.current.map((x) => x.title)).toEqual(["Siyahı yeniləndi."]);
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current[0]?.leaving).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toEqual([]);
  });

  it("keeps errors on screen longer than confirmations", () => {
    const { result } = renderHook(() => useToasts());
    act(() => void toast.error("Şəbəkə xətası"));
    act(() => vi.advanceTimersByTime(4500));
    expect(result.current[0]?.leaving).toBeUndefined();
  });

  it("shows a repeated message once", () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      toast.error("Şəbəkə xətası");
      toast.error("Şəbəkə xətası");
    });
    expect(result.current).toHaveLength(1);
  });

  it("keeps at most three on screen", () => {
    const { result } = renderHook(() => useToasts());
    act(() => ["1", "2", "3", "4"].forEach((n) => toast.info(n)));
    expect(result.current.map((x) => x.title)).toEqual(["2", "3", "4"]);
  });

  it("keeps a sticky toast until it is dismissed and runs its action", () => {
    const { result } = renderHook(() => useToasts());
    const onPress = vi.fn();
    let id = 0;
    act(() => {
      id = toast.show({
        tone: "info",
        title: "Yeni versiya",
        sticky: true,
        action: { label: "Yenilə", onPress },
      });
    });
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current[0]?.leaving).toBeUndefined();
    result.current[0]?.action?.onPress();
    expect(onPress).toHaveBeenCalledOnce();
    act(() => toast.dismiss(id));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toEqual([]);
  });

  it("never pushes a sticky toast out to make room", () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      toast.show({ tone: "info", title: "Yeni versiya", sticky: true });
      toast.info("a");
      toast.info("b");
      toast.info("c");
    });
    expect(result.current.map((x) => x.title)).toEqual(["Yeni versiya", "b", "c"]);
  });
});
