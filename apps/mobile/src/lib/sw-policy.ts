// Requests that may carry a user's data (API, signed file URLs on other origins) must never be
// stored in Cache Storage: the cache key ignores the Authorization header, so a later user on
// the same device could be served them. Deliberate read-only offline caching arrives in M-11.
export function isPrivateRequest({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) {
  return !sameOrigin || url.pathname.startsWith("/v1/");
}
