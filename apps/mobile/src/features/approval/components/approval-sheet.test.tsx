import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PackageDetailScreen } from "@/features/package-detail/components/package-detail-screen";
import { clearSeen, markSeen } from "@/features/package-detail/seen-store";
import { mockToken } from "@/lib/api/mock/handlers";
import { packageDetail } from "@/lib/api/mock/package-detail";
import { resetSessionDb, sessionApprovals } from "@/lib/api/mock/session-db";
import { meFor } from "@/lib/api/mock/store";
import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/mock/mock-fetch", async (load) => {
  const real = await load<typeof import("@/lib/api/mock/mock-fetch")>();
  return { createMockFetch: () => real.createMockFetch({ latencyMs: 0 }) };
});

const ID = "0193a000-0000-7000-8002-000000001038";
const width = Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth")!;
beforeAll(() =>
  Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: () => 366 }),
);
afterAll(() => Object.defineProperty(Element.prototype, "clientWidth", width));
beforeEach(() => {
  clearSeen();
  resetSessionDb();
  push.mockReset();
});

async function openSheet() {
  startSession({
    access_token: mockToken("u2"),
    token_type: "bearer",
    expires_in: 60,
    user: meFor("u2")!,
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <PackageDetailScreen id={ID} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Sübutlara baxıb təsdiqlə" }));
  return screen.findByRole("dialog", { name: "INV-1038 paketini təsdiqləyin" });
}

const seeAll = () => {
  const pkg = packageDetail(ID, "u2")!;
  for (const d of pkg.documents) markSeen(meFor("u2")!.id, pkg, d.current.id);
};
const confirm = (sheet: HTMLElement) => within(sheet).getByRole("button", { name: /Təsdiqlə/ });

describe("approval sheet", () => {
  it("locks the acknowledgement and the confirm until every document is seen", async () => {
    const sheet = await openSheet();
    expect(within(sheet).getByText("0/3 baxılıb")).toBeVisible();
    expect(within(sheet).getByRole("checkbox")).toBeDisabled();
    expect(within(sheet).getByText("Əvvəl 3 sənədə də baxın.")).toBeVisible();
    expect(confirm(sheet)).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(confirm(sheet));
    expect(push).not.toHaveBeenCalled();
    expect(sessionApprovals()).toEqual([]);
    expect(within(sheet).getByText(/bank ödənişinə səlahiyyət vermir/)).toBeVisible();
  });

  it("opens a document from the review and counts it when coming back", async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("button", { name: /Faktura · v1/ }));
    await screen.findByRole("article", { name: "HESAB-FAKTURA INV-1038" });
    fireEvent.click(
      within(screen.getByRole("dialog")).getAllByRole("button", { name: "Geri" }).at(-1)!,
    );
    const back = await screen.findByRole("dialog", { name: "INV-1038 paketini təsdiqləyin" });
    await waitFor(() => expect(within(back).getByText("1/3 baxılıb")).toBeVisible());
  });

  it("approves once, however often the confirm is tapped, and goes to the success screen", async () => {
    seeAll();
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("checkbox"));
    expect(confirm(sheet)).not.toHaveAttribute("aria-disabled");
    fireEvent.click(confirm(sheet));
    fireEvent.click(confirm(sheet));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/packages/${ID}/success`));
    expect(sessionApprovals()).toHaveLength(1);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("says plainly that approval needs a connection", async () => {
    seeAll();
    const sheet = await openSheet();
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(within(sheet).getByRole("alert")).toHaveTextContent(/təsdiq oflayn mümkün deyil/);
    expect(confirm(sheet)).toHaveAttribute("aria-disabled", "true");
    online.mockRestore();
  });
});
