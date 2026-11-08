const HOME = "/home";
const LOGIN = "/login";
const BASE = "https://app.invalid";

// "//host" and "/\\host" are protocol-relative: the router would leave the app.
const isLocalPath = (path: string) =>
  path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");

/** Where to go after sign-in: an in-app path from `?next=`, never another origin or the login. */
export function safeNextPath(raw: string | null): string {
  if (!raw || !isLocalPath(raw)) return HOME;
  const url = new URL(raw, BASE);
  // Parsing removes dot segments ("/.//evil" → "//evil"), so check the result again.
  const path = `${url.pathname}${url.search}`;
  if (url.origin !== BASE || url.pathname === LOGIN || !isLocalPath(path)) return HOME;
  if (new URL(path, BASE).origin !== BASE) return HOME;
  return path;
}

/** The login URL that brings the user back to this page afterwards. */
export function loginHref(pathname: string, search: string): string {
  const here = `${pathname}${search}`;
  return here === HOME || here === "/" ? LOGIN : `${LOGIN}?next=${encodeURIComponent(here)}`;
}
