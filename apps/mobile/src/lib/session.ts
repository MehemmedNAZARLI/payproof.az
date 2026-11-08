import { useSyncExternalStore } from "react";

import type { Schemas } from "./api/client";

// The signed-in demo session (dev-login JWT). Kept in localStorage so an installed PWA stays
// signed in between launches; the server still checks every request (security.md).

export type Session = { token: string; user: Schemas["Me"]; expiresAt: number };
export type SignOutReason = "user" | "expired";

const KEY = "payproof.session";

let current: Session | null | undefined; // undefined: storage not read yet
let lastSignOut: SignOutReason | undefined;
const listeners = new Set<() => void>();

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.token === "string" &&
    typeof v.expiresAt === "number" &&
    typeof v.user === "object" &&
    v.user !== null
  );
}

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    const value: unknown = raw === null ? null : JSON.parse(raw);
    return isSession(value) ? value : null;
  } catch {
    return null;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

/** The current session, or null when signed out or expired. Same object until it changes. */
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  current ??= read();
  return current && current.expiresAt > Date.now() ? current : null;
}

export const getToken = () => getSession()?.token ?? null;

/** How the last session ended: the user signed out, or the server rejected the token. */
export const signOutReason = () => lastSignOut;

export function startSession(issued: Schemas["Session"]): Session {
  const session = {
    token: issued.access_token,
    user: issued.user,
    expiresAt: Date.now() + issued.expires_in * 1000,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Private mode or full storage: the session lasts until the page is closed.
  }
  current = session;
  lastSignOut = undefined;
  emit();
  return session;
}

export function endSession(reason: SignOutReason) {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing stored
  }
  current = null;
  lastSignOut = reason;
  emit();
}

function onStorage(event: StorageEvent) {
  if (event.key !== KEY && event.key !== null) return;
  current = read();
  emit();
}

export function subscribeSession(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** The session; `undefined` while hydrating (the server cannot see localStorage). */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribeSession, getSession, () => undefined);
}
