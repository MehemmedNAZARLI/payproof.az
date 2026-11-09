import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";
import { meFor, mockToken } from "@/test/mock";

import { HomeScreen } from "./home-screen";

function renderAs(slug: string) {
  const user = meFor(slug);
  startSession({ access_token: mockToken(slug), token_type: "bearer", expires_in: 60, user });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}

describe("HomeScreen", () => {
  it("shows the approver what waits for them, by currency", async () => {
    renderAs("u2");
    const hero = await screen.findByRole("link", { name: /Təsdiqinizi gözləyir/ });
    expect(hero).toHaveTextContent("2paket");
    expect(hero).toHaveTextContent("11.060,00 AZN");
    expect(hero).toHaveAttribute("href", "/packages?status=ready");
  });

  it("opens the list filtered from each status tile", async () => {
    renderAs("u2");
    const tiles = within(await screen.findByRole("list", { name: "Statuslar" }));
    expect(tiles.getByRole("link", { name: /Düzəliş tələb edir/ })).toHaveAttribute(
      "href",
      "/packages?status=problem",
    );
    expect(tiles.getByRole("link", { name: /İxrac edilib/ })).toHaveTextContent("2");
  });

  it("keeps AZN and USD problem amounts apart", async () => {
    renderAs("u2");
    const amounts = within(await screen.findByRole("list", { name: "Açıq problemli məbləğ" }));
    expect(amounts.getByText("29.706,00 AZN")).toBeInTheDocument();
    expect(amounts.getByText("1.800,00 USD")).toBeInTheDocument();
  });

  it("lists pending approvals and recent activity", async () => {
    renderAs("u2");
    const pending = within(await screen.findByRole("list", { name: "Təsdiq gözləyənlər" }));
    expect(pending.getAllByRole("listitem")).toHaveLength(2);
    const activity = within(await screen.findByRole("list", { name: "Son fəaliyyət" }));
    expect(activity.getAllByRole("listitem")).toHaveLength(4);
  });

  it("tells an operator the packages wait for the approver", async () => {
    renderAs("u1");
    expect(await screen.findByRole("link", { name: /Təsdiqçini gözləyir/ })).toBeInTheDocument();
  });
});
