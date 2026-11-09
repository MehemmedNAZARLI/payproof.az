import { expect, test, vi } from "vitest";
import { startMocking } from "./msw";

const start = vi.hoisted(() => vi.fn());
vi.mock("@payproof/mocks/browser", () => ({ createMockWorker: () => ({ start }) }));

test("starts the worker once, and a failed start can be retried", async () => {
  start.mockRejectedValueOnce(new Error("no mockServiceWorker.js"));
  await expect(startMocking()).rejects.toThrow("no mockServiceWorker.js");

  start.mockResolvedValue(undefined);
  await startMocking();
  await startMocking();
  expect(start).toHaveBeenCalledTimes(2);
});
