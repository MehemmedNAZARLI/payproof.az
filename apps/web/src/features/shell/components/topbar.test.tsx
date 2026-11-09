import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import { Topbar } from "./topbar";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("./user-menu", () => ({ UserMenu: () => null }));
beforeEach(() => push.mockClear());

test("global search opens the package list filtered by the query", async () => {
  renderWithQuery(<Topbar onOpenNav={vi.fn()} />);
  const search = screen.getByRole("searchbox", { name: "Paket axtar" });
  await userEvent.type(search, "  INV-1042 {Enter}");
  expect(push).toHaveBeenCalledWith("/packages?q=INV-1042");
});

test("an empty search opens the unfiltered list", async () => {
  renderWithQuery(<Topbar onOpenNav={vi.fn()} />);
  await userEvent.type(screen.getByRole("searchbox", { name: "Paket axtar" }), "{Enter}");
  expect(push).toHaveBeenCalledWith("/packages");
});

test("brand, demo tag, menu button and the notifications slot", async () => {
  const onOpenNav = vi.fn();
  renderWithQuery(<Topbar onOpenNav={onOpenNav} />);
  expect(screen.getByRole("link", { name: /PayProof/ })).toHaveAttribute("href", "/overview");
  expect(screen.getByText("Sintetik demo")).toHaveAttribute(
    "title",
    "Bütün məlumatlar sintetikdir",
  );
  // the bell names its unread count once the notifications have loaded
  expect(await screen.findByRole("button", { name: /^Bildirişlər, \d+ oxunmamış$/ })).toBeEnabled();
  await userEvent.click(screen.getByRole("button", { name: "Menyunu aç" }));
  expect(onOpenNav).toHaveBeenCalledOnce();
});
