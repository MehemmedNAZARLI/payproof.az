const HOME = "/home";
const LOGIN = "/login";
const BASE = "https://app.invalid";

/** Where to go after sign-in: an in-app path from `?next=`, never another origin or the login. */
export function safeNextPath(raw: string | null): string {
  if (!raw?.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return HOME;
  const url = new URL(raw, BASE);
  if (url.origin !== BASE || url.pathname === LOGIN) return HOME;
  return `${url.pathname}${url.search}`;
}

/** The login URL that brings the user back to this page afterwards. */
export function loginHref(pathname: string, search: string): string {
  const here = `${pathname}${search}`;
  return here === HOME || here === "/" ? LOGIN : `${LOGIN}?next=${encodeURIComponent(here)}`;
}
