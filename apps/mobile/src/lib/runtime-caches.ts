// Serwist's precache ("serwist-precache-v2-<scope>") holds only the public app shell, which the
// installed app needs to start offline. Everything else in Cache Storage was filled at runtime
// (pages, RSC payloads, assets) while someone was signed in.
const isPrecache = (name: string) => name.includes("-precache-");

/** Deletes the service worker's runtime caches; keeps the app-shell precache. */
export async function clearRuntimeCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !isPrecache(n)).map((n) => caches.delete(n)));
  } catch {
    // Storage blocked (private mode): nothing was cached.
  }
}
