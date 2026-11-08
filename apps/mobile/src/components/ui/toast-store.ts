"use client";

import { useSyncExternalStore } from "react";

export type ToastTone = "success" | "error" | "warning" | "info";
export type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  leaving?: boolean;
};

// Errors stay longer: they usually ask the user to do something.
const DURATION_MS: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 6000,
};
const EXIT_MS = 200;
const MAX_VISIBLE = 3;
const EMPTY: Toast[] = [];

let toasts: Toast[] = EMPTY;
let seq = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function set(next: Toast[]) {
  toasts = next;
  listeners.forEach((l) => l());
}

function remove(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  set(toasts.filter((x) => x.id !== id));
}

function show(input: Omit<Toast, "id" | "leaving">): number {
  // The same message twice (e.g. several requests failing offline) shows once.
  const same = toasts.find((x) => !x.leaving && x.tone === input.tone && x.title === input.title);
  if (same) return same.id;
  const id = ++seq;
  set([...toasts, { ...input, id }].slice(-MAX_VISIBLE));
  timers.set(
    id,
    setTimeout(() => dismiss(id), DURATION_MS[input.tone]),
  );
  return id;
}

// Plays the exit animation, then removes the toast.
function dismiss(id: number) {
  clearTimeout(timers.get(id));
  set(toasts.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
  timers.set(
    id,
    setTimeout(() => remove(id), EXIT_MS),
  );
}

export const toast = {
  show,
  dismiss,
  success: (title: string, description?: string) => show({ tone: "success", title, description }),
  error: (title: string, description?: string) => show({ tone: "error", title, description }),
  info: (title: string, description?: string) => show({ tone: "info", title, description }),
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );
}
