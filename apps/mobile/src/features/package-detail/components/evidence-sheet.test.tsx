import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { mockToken } from "@/lib/api/mock/handlers";
import { meFor } from "@/lib/api/mock/store";
import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";

import { clearSeen } from "../seen-store";
import { PackageDetailScreen } from "./package-detail-screen";

vi.mock("@/lib/api/mock/mock-fetch", async (load) => {
  const real = await load<typeof import("@/lib/api/mock/mock-fetch")>();
  return { createMockFetch: () => real.createMockFetch({ latencyMs: 0 }) };
});

// jsdom lays nothing out; give the document pane a phone's width so pages render.
const width = Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth")!;
beforeAll(() =>
  Object.defineProperty(Element.prototype, "clientWidth", {
    configurable: true,
    get: () => 366,
  }),
);
afterAll(() => Object.defineProperty(Element.prototype, "clientWidth", width));
beforeEach(() => clearSeen());

function open(pkg: number) {
  startSession({
    access_token: mockToken("u2"),
    token_type: "bearer",
    expires_in: 60,
    user: meFor("u2")!,
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <PackageDetailScreen id={`0193a000-0000-7000-8002-00000000${pkg}`} />
    </QueryClientProvider>,
  );
}
const docRow = (name: RegExp) =>
  within(screen.getByRole("list", { name: "Sənədlər" })).getByRole("button", { name });

describe("evidence sheets", () => {
  it("follows a check to its cited region and comes back", async () => {
    open(1044);
    fireEvent.click(await screen.findByRole("button", { name: /Vahid qiymət uyğunluğu/ }));
    const check = await screen.findByRole("dialog", { name: "Vahid qiymət uyğunluğu" });
    expect(within(check).getByText(/KY-10: fakturada 110,00 AZN/)).toBeVisible();
    expect(within(check).getByText("Düzəliş və tapşırıq veb tətbiqdə idarə olunur.")).toBeVisible();

    fireEvent.click(within(check).getByRole("button", { name: /Faktura · v1 · səh\. 1/ }));
    const doc = await screen.findByRole("dialog", { name: "Faktura · v1" });
    await waitFor(() => expect(doc.querySelector("[data-highlight]")).toHaveTextContent("KY-10"));
    expect(within(doc).getByText("Sarı ilə vurğulanan hissə yoxlamanın mənbəyidir.")).toBeVisible();

    fireEvent.click(within(doc).getAllByRole("button", { name: "Geri" }).at(-1)!);
    expect(await screen.findByRole("dialog", { name: "Vahid qiymət uyğunluğu" })).toBeVisible();
  });

  it("marks a document seen once it has been shown, and counts it", async () => {
    open(1038);
    expect(await screen.findByText("0/3 baxılıb")).toBeVisible();
    fireEvent.click(docRow(/Faktura · v1/));
    await screen.findByRole("article", { name: "HESAB-FAKTURA INV-1038" });
    // The footer's "Bağla" (the header has a round close button of the same name).
    fireEvent.click(
      within(screen.getByRole("dialog")).getAllByRole("button", { name: "Bağla" }).at(-1)!,
    );
    await waitFor(() => expect(screen.getByText("1/3 baxılıb")).toBeVisible());
    expect(
      within(screen.getByRole("list", { name: "Sənədlər" })).getByText("Baxılıb"),
    ).toBeVisible();
  });

  it("shows page and quote when the scan cannot be highlighted", async () => {
    open(1047);
    fireEvent.click(await screen.findByRole("button", { name: /Məcburi sifariş nömrəsi/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Faktura · v1 · səh\. 1/ }));
    const doc = await screen.findByRole("dialog", { name: "Faktura · v1" });
    expect(within(doc).getByText(/Skan nüsxədir/)).toBeVisible();
    expect(await within(doc).findByText(/Vurğulama mümkün deyil — səhifə 1/)).toBeVisible();
    expect(within(doc).getByText("Sifariş №: PO-3?7 (oxunmur)")).toBeVisible();
    expect(doc.querySelector("[data-highlight]")).toBeNull();
  });
});
