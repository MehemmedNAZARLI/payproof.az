"use client";

import { useCallback, useState } from "react";

import type { Schemas } from "@/lib/api";

// Pages of the evidence sheet: a check, and the documents its evidence points to. Opening from
// the screen starts over; following evidence goes one level deeper; "Geri" comes back.
export type SheetRoute =
  | { kind: "check"; ruleId: string }
  | { kind: "document"; documentId: string; evidence: Schemas["Evidence"] | null };

type State = { stack: SheetRoute[]; direction: "push" | "pop"; shown: SheetRoute | null };

export function useSheetStack() {
  const [state, setState] = useState<State>({ stack: [], direction: "push", shown: null });
  const open = useCallback(
    (route: SheetRoute) => setState({ stack: [route], direction: "push", shown: route }),
    [],
  );
  const push = useCallback(
    (route: SheetRoute) =>
      setState((s) => ({ stack: [...s.stack, route], direction: "push", shown: route })),
    [],
  );
  const back = useCallback(
    () =>
      setState((s) => {
        const stack = s.stack.slice(0, -1);
        return { stack, direction: "pop", shown: stack.at(-1) ?? s.shown };
      }),
    [],
  );
  // `shown` stays on the last page, so the closing sheet does not empty mid-animation.
  const close = useCallback(() => setState((s) => ({ ...s, stack: [] })), []);
  return {
    top: state.stack.at(-1) ?? null,
    shown: state.shown,
    depth: state.stack.length,
    direction: state.direction,
    open,
    push,
    back,
    close,
  };
}
