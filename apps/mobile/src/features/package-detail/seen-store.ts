"use client";

import { useCallback, useSyncExternalStore } from "react";

// Which document versions the user has opened, per package version (M-08). Approval (M-09)
// needs every document of the *current* version seen, so an entry for another package version
// counts as nothing seen and is replaced on the next view. Kept in this tab's sessionStorage:
// a reload keeps it, a new tab or a new sign-in starts over. A UX guard only — the server
// decides who may approve.

const KEY = "payproof.seen";
type Entry = { version: number; seen: string[] };
type State = Record<string, Entry>;
type Pkg = { id: string; version: number };

const listeners = new Set<() => void>();
let cache: { raw: string | null; state: State } = { raw: null, state: {} };

// Falls back to page memory when sessionStorage is blocked or full.
let memory: string | null = null;
let memoryOnly = false;

function storage(): Storage | undefined {
  if (memoryOnly || typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage;
  } catch {
    memoryOnly = true;
    return undefined;
  }
}

const read = () => {
  const store = storage();
  return store ? store.getItem(KEY) : memory;
};

function load(): State {
  const raw = read();
  if (raw !== cache.raw) {
    let state: State = {};
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object") state = parsed as State;
    } catch {
      // damaged entry: nothing counts as seen
    }
    cache = { raw, state };
  }
  return cache.state;
}

function save(state: State) {
  const raw = Object.keys(state).length ? JSON.stringify(state) : null;
  memory = raw;
  try {
    if (raw === null) storage()?.removeItem(KEY);
    else storage()?.setItem(KEY, raw);
  } catch {
    memoryOnly = true; // quota: keep counting views for this page
  }
  listeners.forEach((l) => l());
}

const keyOf = (userId: string, pkg: Pkg) => `${userId}|${pkg.id}`;

function seenList(userId: string, pkg: Pkg): string[] {
  const entry = load()[keyOf(userId, pkg)];
  return entry?.version === pkg.version && Array.isArray(entry.seen) ? entry.seen : [];
}

export const isSeen = (userId: string, pkg: Pkg, versionId: string) =>
  seenList(userId, pkg).includes(versionId);

export const seenCount = (userId: string, pkg: Pkg, versionIds: string[]) =>
  versionIds.filter((id) => isSeen(userId, pkg, id)).length;

export function markSeen(userId: string, pkg: Pkg, versionId: string) {
  const seen = seenList(userId, pkg);
  if (seen.includes(versionId)) return;
  save({ ...load(), [keyOf(userId, pkg)]: { version: pkg.version, seen: [...seen, versionId] } });
}

/** Forget every view (sign-out, another user signs in). */
export function clearSeen() {
  save({});
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Seen state of one package version for the signed-in user; re-renders when it changes. */
export function useSeen(userId: string | undefined, pkg: Pkg) {
  const { id, version } = pkg;
  // The raw snapshot changes whenever the store does, which refreshes `isSeen`.
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const check = useCallback(
    (versionId: string) =>
      raw !== null && userId !== undefined && isSeen(userId, { id, version }, versionId),
    [raw, userId, id, version],
  );
  const mark = useCallback(
    (versionId: string) => {
      if (userId !== undefined) markSeen(userId, { id, version }, versionId);
    },
    [userId, id, version],
  );
  return { isSeen: check, markSeen: mark };
}
