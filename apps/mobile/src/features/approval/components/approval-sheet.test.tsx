import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PackageDetailScreen } from "@/features/package-detail/components/package-detail-screen";
import { packageDetailKeys } from "@/features/package-detail/queries";
import { clearSeen, markSeen } from "@/features/package-detail/seen-store";
import type { Schemas } from "@/lib/api";
import { unwrap } from "@/lib/api";
import { useLiveUpdates } from "@/lib/live";
import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";
import { detailOf, meFor, mockClient, mockToken, recordedApprovals } from "@/test/mock";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// Every POST /approve is recorded with its key; `fail` answers the next ones instead of the mock.
const wire = vi.hoisted(() => ({
  keys: [] as (string | null)[],
  fail: [] as (() => Response)[],
}));
vi.mock("@/lib/api/mock/mock-fetch", async (load) => {
  const real = await load<typeof import("@/lib/api/mock/mock-fetch")>();
  const fetch = real.createMockFetch();
  return {
    ...real,
    createMockFetch: () => async (request: Request) => {
      if (request.method === "POST" && request.url.endsWith("/approve")) {
        wire.keys.push(request.headers.get("Idempotency-Key"));
        const fail = wire.fail.shift();
        if (fail) return fail();
      }
      return fetch(request);
    },
  };
});
const error =
  (status: number, code: string, details = {}) =>
  () =>
    Response.json({ error: { code, message: "x", details } }, { status });
const networkDown = () => {
  throw new TypeError("Failed to fetch");
};

const ID = "0193a000-0000-7000-8002-000000001038";
const width = Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth")!;
beforeAll(() =>
  Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: () => 366 }),
);
afterAll(() => Object.defineProperty(Element.prototype, "clientWidth", width));
beforeEach(() => {
  clearSeen();
  push.mockReset();
  wire.keys.length = 0;
  wire.fail.length = 0;
});

// The app's one live stream (providers.tsx), over the in-page mock.
function LiveBridge() {
  useLiveUpdates();
  return null;
}

let client = createQueryClient();
async function openSheet() {
  client = createQueryClient();
  startSession({
    access_token: mockToken("u2"),
    token_type: "bearer",
    expires_in: 60,
    user: meFor("u2"),
  });
  render(
    <QueryClientProvider client={client}>
      <PackageDetailScreen id={ID} />
      <LiveBridge />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Review evidence and approve" }));
  return screen.findByRole("dialog", { name: "INV-1038 — approve package" });
}

const seeAll = async () => {
  const pkg = await detailOf(ID);
  for (const d of pkg.documents) markSeen(meFor("u2").id, pkg, d.current.id);
};
const confirm = (sheet: HTMLElement) => within(sheet).getByRole("button", { name: /Approve/ });

describe("approval sheet", () => {
  it("locks the acknowledgement and the confirm until every document is seen", async () => {
    const sheet = await openSheet();
    expect(within(sheet).getByText("0/3 reviewed")).toBeVisible();
    expect(within(sheet).getByRole("checkbox")).toBeDisabled();
    expect(within(sheet).getByText("First review 3 more documents.")).toBeVisible();
    expect(confirm(sheet)).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(confirm(sheet));
    expect(push).not.toHaveBeenCalled();
    expect(recordedApprovals()).toEqual([]);
    expect(within(sheet).getByText(/does not authorize a bank payment/)).toBeVisible();
  });

  it("opens a document from the review and counts it when coming back", async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("button", { name: /Invoice · v1/ }));
    await screen.findByRole("article", { name: "HESAB-FAKTURA INV-1038" });
    fireEvent.click(
      within(screen.getByRole("dialog")).getAllByRole("button", { name: "Back" }).at(-1)!,
    );
    const back = await screen.findByRole("dialog", { name: "INV-1038 — approve package" });
    await waitFor(() => expect(within(back).getByText("1/3 reviewed")).toBeVisible());
  });

  it("approves once, however often the confirm is tapped, and goes to the success screen", async () => {
    await seeAll();
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("checkbox"));
    expect(confirm(sheet)).not.toHaveAttribute("aria-disabled");
    fireEvent.click(confirm(sheet));
    fireEvent.click(confirm(sheet));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/packages/${ID}/success`));
    expect(recordedApprovals()).toHaveLength(1);
    expect(push).toHaveBeenCalledTimes(1);
    // The client itself sent one request, not just the server deduplicating two.
    expect(wire.keys).toHaveLength(1);
  });

  it("retries a lost request with the same key", async () => {
    await seeAll();
    wire.fail.push(networkDown);
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("checkbox"));
    fireEvent.click(confirm(sheet));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(/Approval requires you to be online/);
    fireEvent.click(confirm(sheet));
    await waitFor(() => expect(push).toHaveBeenCalledOnce());
    expect(wire.keys).toHaveLength(2);
    expect(wire.keys[1]).toBe(wire.keys[0]);
  });

  it("on 409 asks for a new review and sends the next attempt with a new key", async () => {
    await seeAll();
    wire.fail.push(error(409, "VERSION_CONFLICT"));
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("checkbox"));
    fireEvent.click(confirm(sheet));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "Package updated. Review it again",
    );
    expect(within(sheet).getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(within(sheet).getByRole("checkbox"));
    fireEvent.click(confirm(sheet));
    await waitFor(() => expect(push).toHaveBeenCalledOnce());
    expect(wire.keys[1]).not.toBe(wire.keys[0]);
  });

  it("holds the confirm until the newer version the server named has loaded", async () => {
    await seeAll();
    wire.fail.push(error(409, "VERSION_CONFLICT", { current_version: 2 }));
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("checkbox"));
    fireEvent.click(confirm(sheet));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("(v2)");
    fireEvent.click(within(sheet).getByRole("checkbox"));
    expect(confirm(sheet)).toHaveAttribute("aria-disabled", "true");
  });

  it("explains a 403 in place", async () => {
    await seeAll();
    wire.fail.push(error(403, "FORBIDDEN"));
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("checkbox"));
    fireEvent.click(confirm(sheet));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "You do not have approval permission",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("drops the acknowledgement and the seen documents when the version changes", async () => {
    await seeAll();
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("checkbox"));
    expect(within(sheet).getByRole("checkbox")).toBeChecked();
    const key = packageDetailKeys.detail(ID);
    act(() => client.setQueryData<Schemas["PackageDetail"]>(key, (d) => d && { ...d, version: 2 }));
    await waitFor(() => expect(within(sheet).getByText(/I reviewed the documents and check results for v2/)).toBeVisible());
    expect(within(sheet).getByRole("checkbox")).not.toBeChecked();
    expect(within(sheet).getByText("0/3 reviewed")).toBeVisible();
  });

  it("says at once when someone else makes a newer version, and holds the confirm", async () => {
    await seeAll();
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("checkbox"));
    expect(confirm(sheet)).not.toHaveAttribute("aria-disabled");
    // Aygün (operator) confirms the PO field on the web: the package moves to v2.
    const field = (await detailOf(ID, "u1")).fields[0]!;
    await unwrap(
      mockClient("u1").PATCH("/v1/fields/{field_id}", {
        params: { path: { field_id: field.id } },
        body: { value: field.value!, reason: "Order nömrəsi yoxlanıldı", expected_version: 1 },
      }),
    );
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "Another user updated the package (v2)",
    );
    expect(confirm(sheet)).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(confirm(sheet));
    expect(recordedApprovals()).toHaveLength(0);
    // v2 loads by itself; it has to be reviewed again, and the notice stays to say why.
    await waitFor(() => expect(within(sheet).getByText(/I reviewed the documents and check results for v2/)).toBeVisible());
    expect(within(sheet).getByText("0/3 reviewed")).toBeVisible();
    expect(within(sheet).getByRole("alert")).toHaveTextContent("(v2)");
  });

  it("tells a screen reader why a locked confirm did nothing", async () => {
    const sheet = await openSheet();
    fireEvent.click(confirm(sheet));
    expect(within(sheet).getByRole("status")).toHaveTextContent(
      "Review every document before approving.",
    );
  });

  it("says plainly that approval needs a connection", async () => {
    await seeAll();
    const sheet = await openSheet();
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(within(sheet).getByRole("alert")).toHaveTextContent(/Approval requires you to be online/);
    expect(confirm(sheet)).toHaveAttribute("aria-disabled", "true");
    online.mockRestore();
  });
});
