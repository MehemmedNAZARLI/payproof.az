import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSheetStack } from "./sheet-stack";

const check = { kind: "check", ruleId: "R-005" } as const;
const doc = { kind: "document", documentId: "d1", evidence: null } as const;

describe("useSheetStack", () => {
  it("opens, goes deeper, comes back and closes", () => {
    const { result } = renderHook(() => useSheetStack());
    act(() => result.current.open(check));
    expect(result.current).toMatchObject({ top: check, depth: 1, direction: "push" });
    act(() => result.current.push(doc));
    expect(result.current).toMatchObject({ top: doc, depth: 2, direction: "push" });
    act(() => result.current.back());
    expect(result.current).toMatchObject({ top: check, depth: 1, direction: "pop" });
    act(() => result.current.close());
    expect(result.current.top).toBeNull();
  });

  it("keeps showing the last page while the sheet animates away", () => {
    const { result } = renderHook(() => useSheetStack());
    act(() => result.current.open(doc));
    act(() => result.current.close());
    expect(result.current).toMatchObject({ top: null, shown: doc });
  });

  it("starts a new stack when opened from the screen", () => {
    const { result } = renderHook(() => useSheetStack());
    act(() => result.current.open(check));
    act(() => result.current.push(doc));
    act(() => result.current.open(doc));
    expect(result.current.depth).toBe(1);
  });
});
