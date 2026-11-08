import { getResponse } from "msw";

import { apiError, handlers } from "./handlers";

// Enough delay to see skeletons and refetch states, as with a real server.
const LATENCY_MS = 350;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

// A fetch that answers API requests in the page with the MSW handlers. No MSW service worker:
// Serwist's worker owns the scope (docs/progress/mobile.md, M-02 decision).
export function createMockFetch({ latencyMs = LATENCY_MS } = {}) {
  return async (request: Request): Promise<Response> => {
    // DevTools' offline switch cannot reach an in-page mock, so mirror a real network failure.
    if (typeof navigator !== "undefined" && !navigator.onLine)
      throw new TypeError("Failed to fetch");
    if (latencyMs > 0) await wait(latencyMs, request.signal);
    const response = await getResponse(handlers, request);
    return (
      response ??
      apiError(404, "NOT_FOUND", "Obyekt tapılmadı.", { path: new URL(request.url).pathname })
    );
  };
}
