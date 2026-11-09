import "@testing-library/jest-dom/vitest";
import { resetMockDb, server } from "@payproof/mocks/node";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { setToken } from "@/lib/auth";

// jsdom has no matchMedia: every query reports "no match" (a narrow, mouse-less screen).
// (guarded: a few request-level tests run in the node environment)
if (typeof window !== "undefined")
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;

// jsdom has no app router: a default stub, so screens that navigate after an action can render.
// Tests that check navigation mock next/navigation themselves (their mock wins).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  cleanup();
  resetMockDb();
  setToken(null);
});
afterAll(() => server.close());
