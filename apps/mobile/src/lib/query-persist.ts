import {
  dehydrate,
  type DehydratedState,
  hydrate,
  type Query,
  type QueryClient,
} from "@tanstack/react-query";

// The offline read cache: what the signed-in user last loaded, so the installed app can show it
// again after a relaunch without a connection. Read-only by construction — only query results are
// stored, never mutations, and approval itself checks the connection (approval flow).
//
// It lives in localStorage beside the session token, tagged with the user, and goes with them:
// a user change while the app runs (sign-out, expiry, another tab) clears it (providers.tsx), and
// at launch a cache that is not the signed-in user's, or older than a day, is deleted unread.
// Signed document links are left out — they expire within minutes anyway.

const KEY = "payproof.cache";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const WRITE_DELAY_MS = 500;
// Bump when a stored response shape changes, so an old cache is ignored rather than misread.
const VERSION = 1;
const ROOTS = new Set(["packages", "dashboard", "audit", "notifications"]);

type Stored = { v: number; user: string; savedAt: number; state: DehydratedState };

const persistable = (query: Query) => {
  const [root, sub] = query.queryKey as unknown[];
  if (query.state.status !== "success") return false;
  // Each query ages on its own: one restored on every relaunch must still expire.
  if (Date.now() - query.state.dataUpdatedAt > MAX_AGE_MS) return false;
  if (root === "auth") return sub === "me";
  return typeof root === "string" && ROOTS.has(root);
};

function read(): Stored | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Stored | null;
    return parsed?.v === VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function write(qc: QueryClient, user: string) {
  const state = dehydrate(qc, { shouldDehydrateQuery: persistable });
  const stored: Stored = { v: VERSION, user, savedAt: Date.now(), state };
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Full or blocked storage: the app still works, just not offline after a relaunch.
  }
}

/**
 * Puts the signed-in user's saved queries back; newer data already in the client wins. A cache
 * that is not theirs, or too old, is deleted — e.g. a session that expired while the app was
 * closed never fires a user change, so this is where it goes.
 */
export function restoreQueries(qc: QueryClient, user: string | undefined) {
  const stored = read();
  if (!stored) return;
  if (!user || stored.user !== user || Date.now() - stored.savedAt > MAX_AGE_MS) {
    clearPersistedQueries();
    return;
  }
  hydrate(qc, stored.state);
}

/**
 * Saves the cache shortly after it changes, for whoever `currentUser` names at write time.
 * The returned stop function writes once more and unsubscribes.
 */
export function persistQueries(qc: QueryClient, currentUser: () => string | undefined) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    const user = currentUser();
    if (user) write(qc, user);
  };
  const unsubscribe = qc.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success" || timer) return;
    timer = setTimeout(flush, WRITE_DELAY_MS);
  });
  // A backgrounded app may be killed without warning: save what is pending now.
  const onHide = () => document.visibilityState === "hidden" && timer && flush();
  document.addEventListener("visibilitychange", onHide);
  return () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", onHide);
    flush();
  };
}

export function clearPersistedQueries() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // blocked storage held nothing
  }
}
