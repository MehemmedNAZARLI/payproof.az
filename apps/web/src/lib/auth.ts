// Session token: memory first, sessionStorage so a reload keeps the tab signed in.
// Storage can be missing (SSR) or blocked (private mode) — then the token lives in memory only.
const KEY = "payproof.token";

let token: string | null | undefined; // undefined = not read from storage yet

export function getToken(): string | null {
  if (token === undefined) {
    try {
      token = sessionStorage.getItem(KEY);
    } catch {
      token = null;
    }
  }
  return token;
}

export function setToken(next: string | null): void {
  token = next;
  try {
    if (next) sessionStorage.setItem(KEY, next);
    else sessionStorage.removeItem(KEY);
  } catch {
    // memory-only session
  }
}
