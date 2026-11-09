import { mockIds } from "@payproof/mocks";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { Sidebar } from "./sidebar";

const toastInfo = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { info: toastInfo } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/packages/0193a000" }));

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

test("marks the current section, including its detail pages", () => {
  renderWithQuery(<Sidebar collapsed={false} />);
  const nav = screen.getByRole("navigation", { name: "Əsas naviqasiya" });
  expect(within(nav).getByRole("link", { name: "Faktura paketləri" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(within(nav).getByRole("link", { name: "İcmal" })).not.toHaveAttribute("aria-current");
  expect(within(nav).getByRole("link", { name: "Audit tarixçəsi" })).toHaveAttribute(
    "href",
    "/audit",
  );
});

test("shows the open task count and the company from /v1/me", async () => {
  renderWithQuery(<Sidebar collapsed={false} />);
  // the visible count is part of the name (WCAG 2.5.3 label in name)
  const tasks = await screen.findByRole("link", { name: /^Tapşırıqlar/ });
  await waitFor(() => expect(tasks).toHaveAccessibleName("Tapşırıqlar 6 açıq"));
  expect(await screen.findByText("A Distribusiya MMC")).toBeInTheDocument();
});

test("P1 items only announce that they are coming", async () => {
  renderWithQuery(<Sidebar collapsed={false} />);
  await userEvent.click(screen.getByRole("button", { name: /ERP inteqrasiyası/ }));
  expect(toastInfo).toHaveBeenCalledWith("ERP inteqrasiyası — tezliklə. MVP-yə daxil deyil.");
});

test("collapsed: labels stay as accessible names, the toggle says what it does", async () => {
  const onToggle = vi.fn();
  renderWithQuery(<Sidebar collapsed onToggleCollapse={onToggle} />);
  expect(screen.getByRole("link", { name: "İcmal" })).toHaveAttribute("title", "İcmal");
  await userEvent.click(screen.getByRole("button", { name: "Menyunu genişləndir" }));
  expect(onToggle).toHaveBeenCalledOnce();
});
