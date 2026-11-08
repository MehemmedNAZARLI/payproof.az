import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockToken } from "@/lib/api/mock/handlers";
import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";

import { PackagesScreen } from "./packages-screen";

vi.mock("@/lib/api/mock/mock-fetch", async (load) => {
  const real = await load<typeof import("@/lib/api/mock/mock-fetch")>();
  return { createMockFetch: () => real.createMockFetch({ latencyMs: 0 }) };
});

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

function open(query: string) {
  search = query;
  startSession({
    access_token: mockToken("u2"),
    token_type: "bearer",
    expires_in: 60,
    user: {} as never,
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <PackagesScreen />
    </QueryClientProvider>,
  );
}

const rows = async () =>
  within(await screen.findByRole("list", { name: "Paketlər" })).getAllByRole("listitem");

beforeEach(() => replace.mockClear());

describe("PackagesScreen", () => {
  it("takes its filter from the URL and counts every chip", async () => {
    open("status=problem");
    expect(await rows()).toHaveLength(8);
    expect(screen.getByRole("button", { name: /^Problemli/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByRole("button", { name: "Hamısı 14" })).toBeInTheDocument();
  });

  it("writes a chosen chip into the URL", async () => {
    open("");
    fireEvent.click(await screen.findByRole("button", { name: /^Təsdiq gözləyir/ }));
    expect(replace).toHaveBeenCalledWith("/packages?status=ready", { scroll: false });
  });

  it("searches once typing pauses, keeping the filter", async () => {
    open("status=problem");
    fireEvent.change(screen.getByRole("searchbox", { name: "Paket axtar" }), {
      target: { value: "1042" },
    });
    expect(replace).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/packages?status=problem&q=1042", { scroll: false }),
    );
  });

  it("searches by customer from the URL", async () => {
    open("q=restoran");
    for (const row of await rows()) expect(row).toHaveTextContent("C Restoran Qrupu");
  });

  it("offers to clear an empty result", async () => {
    open("status=exported&q=1042");
    fireEvent.click(await screen.findByRole("button", { name: "Filtri təmizlə" }));
    expect(replace).toHaveBeenCalledWith("/packages", { scroll: false });
  });
});
