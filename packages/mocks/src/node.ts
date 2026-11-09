// Node (Vitest, scripts): an MSW server over a fresh demo company. `resetMockDb()` between tests.
import { setupServer } from "msw/node";
import { createMockApi, type MockApiOptions } from "./handlers";

export function createMockServer(options: MockApiOptions = {}) {
  const api = createMockApi(options);
  return { server: setupServer(...api.handlers), api, resetMockDb: api.reset };
}

const instance = createMockServer();
/** Shared server: `server.listen({ onUnhandledFrame: "error" })` in test setup, `resetMockDb()` in afterEach. */
export const server = instance.server;
export const mockApi = instance.api;
export const resetMockDb = instance.resetMockDb;
