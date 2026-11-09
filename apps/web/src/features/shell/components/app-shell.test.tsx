import { mockIds } from "@payproof/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/overview",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
beforeEach(() => {
  setToken(`mock.${mockIds.user("u1")}`);
  localStorage.clear();
});

const shell = () => renderWithQuery(<AppShell>məzmun</AppShell>);

test("skip link jumps to the main content", () => {
  shell();
  expect(screen.getByRole("link", { name: "Məzmuna keç" })).toHaveAttribute("href", "#content");
  expect(screen.getByRole("main")).toHaveAttribute("id", "content");
});

test("the collapsed sidebar is remembered", async () => {
  const first = shell();
  const toggle = screen.getByRole("button", { name: "Menyunu yığ" });
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  await userEvent.click(toggle);
  expect(screen.getByRole("button", { name: "Menyunu genişləndir" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  first.unmount();
  shell();
  expect(screen.getByRole("button", { name: "Menyunu genişləndir" })).toBeInTheDocument();
});

test("mobile drawer: opens from the menu button, closes on Esc and after navigating", async () => {
  shell();
  const menuButton = screen.getByRole("button", { name: "Menyunu aç" });
  expect(menuButton).toHaveAttribute("aria-expanded", "false");
  expect(menuButton).toHaveAttribute("aria-haspopup", "dialog");
  await userEvent.click(menuButton);
  const drawer = await screen.findByRole("dialog", { name: "Menyu" });
  expect(menuButton).toHaveAttribute("aria-expanded", "true");
  expect(drawer).toContainElement(screen.getAllByRole("link", { name: "İcmal" }).at(-1)!);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Menyunu aç" })).toHaveFocus();

  await userEvent.click(screen.getByRole("button", { name: "Menyunu aç" }));
  const links = await screen.findAllByRole("link", { name: /^Tapşırıqlar/ });
  await userEvent.click(links.at(-1)!);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
