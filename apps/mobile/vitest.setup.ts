import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

// next/font is a compiler transform; outside Next it only has to hand back class names.
vi.mock("next/font/local", () => ({
  default: () => ({ className: "font", variable: "font-var", style: { fontFamily: "Inter" } }),
}));

// jsdom has no matchMedia. Report reduced motion so sheets and toasts settle in one frame.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("prefers-reduced-motion: reduce"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom does not scroll elements; the document viewer scrolls its pane to the cited region.
Element.prototype.scrollBy ??= () => {};
Element.prototype.scrollTo ??= () => {};

// Every test starts from the fixtures demo company (@payproof/mocks, in-page).
afterEach(async () => {
  const { mockApi } = await import("@/lib/api/mock/mock-fetch");
  mockApi().reset();
});
