import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";
import { mockToken } from "@/test/mock";

import { PackagesScreen } from "./packages-screen";

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
  const client = createQueryClient();
  const ui = () => (
    <QueryClientProvider client={client}>
      <PackagesScreen />
    </QueryClientProvider>
  );
  const view = render(ui());
  return { navigateTo: (query: string) => ((search = query), view.rerender(ui())) };
}

const rows = async () =>
  within(await screen.findByRole("list", { name: "Packages" })).getAllByRole("listitem");

beforeEach(() => replace.mockClear());

describe("PackagesScreen", () => {
  it("takes its filter from the URL and counts every chip", async () => {
    open("status=problem");
    expect(await rows()).toHaveLength(8);
    expect(screen.getByRole("button", { name: /^Needs attention/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByRole("button", { name: "All 14" })).toBeInTheDocument();
  });

  it("writes a chosen chip into the URL", async () => {
    open("");
    fireEvent.click(await screen.findByRole("button", { name: /^Awaiting approval/ }));
    expect(replace).toHaveBeenCalledWith("/packages?status=ready", { scroll: false });
  });

  it("searches once typing pauses, keeping the filter", async () => {
    open("status=problem");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search packages" }), {
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
    fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
    expect(replace).toHaveBeenCalledWith("/packages", { scroll: false });
  });

  it("follows the URL when it changes from outside, without writing the old search back", async () => {
    const { navigateTo } = open("status=problem&q=1038");
    const box = screen.getByRole("searchbox", { name: "Search packages" });
    expect(box).toHaveValue("1038");
    navigateTo(""); // e.g. the Packages tab
    expect(box).toHaveValue("");
    navigateTo("status=problem&q=1038"); // and back
    expect(box).toHaveValue("1038");
    await new Promise((r) => setTimeout(r, 400));
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not overwrite what is being typed when its own search lands in the URL", async () => {
    const { navigateTo } = open("");
    const box = screen.getByRole("searchbox", { name: "Search packages" });
    fireEvent.change(box, { target: { value: "10" } });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/packages?q=10", { scroll: false }));
    fireEvent.change(box, { target: { value: "104" } });
    navigateTo("q=10");
    expect(box).toHaveValue("104");
  });
});
