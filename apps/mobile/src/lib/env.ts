// NEXT_PUBLIC_* values are inlined at build time, so they must be read literally.
export const env = {
  /** Mock API answered in the page (default until M-12). `NEXT_PUBLIC_API_MOCK=0` → real API. */
  apiMock: process.env.NEXT_PUBLIC_API_MOCK !== "0",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
};
