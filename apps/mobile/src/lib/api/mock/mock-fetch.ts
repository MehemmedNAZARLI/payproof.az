import { createMockApi } from "@payproof/mocks";
import { getResponse, HttpResponse } from "msw";

// Enough delay to see skeletons and refetch states, as with a real server.
const LATENCY_MS = 350;

let shared: ReturnType<typeof createMockApi> | undefined;

/**
 * The page's demo company (@payproof/mocks): one in-memory DB per tab. Outside tests, tabs of the
 * same origin stay in sync over a BroadcastChannel, so a write in one shows up live in the others.
 */
export function mockApi() {
  shared ??= createMockApi({
    latencyMs: process.env.NODE_ENV === "test" ? 0 : LATENCY_MS,
    jobDelayMs: 800,
    channel:
      process.env.NODE_ENV !== "test" && typeof window !== "undefined"
        ? "payproof-mock"
        : undefined,
  });
  return shared;
}

// A fetch that answers API requests in the page with the shared MSW handlers. No MSW service
// worker: Serwist's worker owns the scope (docs/progress/mobile.md, M-02 decision).
export function createMockFetch() {
  return async (request: Request): Promise<Response> => {
    // DevTools' offline switch cannot reach an in-page mock, so mirror a real network failure.
    if (typeof navigator !== "undefined" && !navigator.onLine)
      throw new TypeError("Failed to fetch");
    const response = await getResponse(mockApi().handlers, request);
    return (
      response ??
      HttpResponse.json(
        { error: { code: "NOT_FOUND", message: "Obyekt tapılmadı.", details: {} } },
        { status: 404 },
      )
    );
  };
}
