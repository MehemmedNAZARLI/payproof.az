import type { Schemas } from "@payproof/api-client";
import { useSyncExternalStore } from "react";

// The signed-in demo session (dev-login JWT). Kept in localStorage so an installed PWA stays
// signed in between launches; the server still checks every request (security.md).

export type Session = { token: string; user: Schemas["Me"]; expiresAt: number };
export type SignOutReason = "user" | "expired";

const KEY = "payproof.session";

let current: Session | null | undefined; // undefined: storage not read yet
let lastSignOut: SignOutReason | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
// setTimeout's ceiling (~24.8 days); a longer wait is simply re-armed.
const MAX_DELAY_MS = 2 ** 31 - 1;

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

// Ends the session when its token expires, so the guard moves on to the login by itself.
function armExpiry() {
  clearTimeout(expiryTimer);
  if (!current) return;
  const delay = Math.min(Math.max(0, current.expiresAt - Date.now()), MAX_DELAY_MS);
  expiryTimer = setTimeout(checkExpiry, delay);
}

// Timers stall while a PWA sleeps in the background, so returning to it checks again.
function checkExpiry() {
  if (current && current.expiresAt <= Date.now()) endSession("expired");
  else armExpiry();
}

function stored(): Session | null {
  if (current === undefined) {
    current = read();
    armExpiry();
  }
  return current;
}

/** The current session, or null when signed out or expired. Same object until it changes. */
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const session = stored();
  return session && session.expiresAt > Date.now() ? session : null;
}

/** True while a token is kept, even an expired one — a 401 then ends it. */
export const hasStoredSession = () => typeof window !== "undefined" && stored() !== null;

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
  armExpiry();
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
  armExpiry();
  emit();
}

function onStorage(event: StorageEvent) {
  if (event.key !== KEY && event.key !== null) return;
  current = read();
  // Signed out in another tab: start over from home here too, without a return path.
  if (!current) lastSignOut = "user";
  armExpiry();
  emit();
}

const onVisible = () => document.visibilityState === "visible" && checkExpiry();

export function subscribeSession(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/**
 * Calls `onChange` when a signed-in user's token goes away or is replaced — here or in another
 * tab — so whatever was fetched with it can be dropped. Signing in from signed-out does not count.
 */
export function watchUserChange(onChange: () => void) {
  let token = getToken();
  return subscribeSession(() => {
    const next = getToken();
    if (token !== null && next !== token) onChange();
    token = next;
  });
}

/** The session; `undefined` while hydrating (the server cannot see localStorage). */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribeSession, getSession, () => undefined);
}
