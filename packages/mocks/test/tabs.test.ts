// Two browser tabs of the same origin = two mock APIs on one BroadcastChannel (ADR-0010, mock mode).
import { createApiClient, subscribeEvents, unwrap, type Schemas } from "@payproof/api-client";
import { getResponse } from "msw";
import { afterEach, expect, it } from "vitest";
import { createMockApi } from "../src";
import { tokenFor } from "../src/handlers/http";
import { id } from "../src/ids";

const BASE = "http://mock.test";
const channel = `payproof-test-${Math.random()}`;
const tabA = createMockApi({ channel });
const tabB = createMockApi({ channel });
const stops: (() => void)[] = [];
afterEach(() => stops.splice(0).forEach((s) => s()));
afterEach(() => (tabA.close(), tabB.close()));

const fetchFrom = (tab: typeof tabA) => async (r: Request) =>
  (await getResponse(tab.handlers, r)) ?? Response.error();
const getToken = () => tokenFor(id.user("u2"));

it("a write in tab A reaches tab B's mock DB and live stream within 2 s", async () => {
  const seen: Schemas["LiveEvent"][] = [];
  let opened!: () => void;
  const open = new Promise<void>((r) => (opened = r));
  stops.push(
    subscribeEvents({
      baseUrl: BASE,
      getToken,
      fetch: fetchFrom(tabB),
      onOpen: () => opened(),
      onEvent: (e) => seen.push(e),
    }),
  );
  await open;

  const started = Date.now();
  const clientA = createApiClient({ baseUrl: BASE, getToken, fetch: fetchFrom(tabA) });
  await unwrap(
    clientA.POST("/v1/packages/{package_id}/approve", {
      params: {
        path: { package_id: id.pkg("pkg_1038") },
        header: { "Idempotency-Key": "00000000-0000-4000-8000-000000000001" },
      },
      body: { expected_version: 1, expected_requirement_set_version: 2, documents_reviewed: true },
    }),
  );
  await expect
    .poll(() => seen.map((e) => e.type), { timeout: 2_000 })
    .toContain("package.approved");
  expect(Date.now() - started).toBeLessThan(2_000);

  // tab B now serves the approved state from its own (replaced) DB
  const clientB = createApiClient({ baseUrl: BASE, getToken, fetch: fetchFrom(tabB) });
  const detail = await unwrap(
    clientB.GET("/v1/packages/{package_id}", {
      params: { path: { package_id: id.pkg("pkg_1038") } },
    }),
  );
  expect(detail.status).toBe("APPROVED_READY");
});
