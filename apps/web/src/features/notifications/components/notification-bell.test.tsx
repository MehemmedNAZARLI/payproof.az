import { mockIds } from "@payproof/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { NotificationBell } from "./notification-bell";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));
beforeEach(() => {
  setToken(`mock.${mockIds.user("u1")}`);
  nav.push.mockReset();
});

const bell = () => screen.findByRole("button", { name: /^Bildirişlər, [1-9]\d* oxunmamış$/ });

test("opening lists notifications newest first; unread ones are marked for screen readers", async () => {
  renderWithQuery(<NotificationBell className="" />);
  await userEvent.click(await bell());
  const pop = await screen.findByRole("dialog", { name: "Bildirişlər" });
  expect(within(pop).getAllByRole("listitem").length).toBeGreaterThan(0);
  expect(within(pop).getAllByText("Oxunmamış:").length).toBeGreaterThan(0);
});

test("a click marks the notification read, closes the popover and opens its package", async () => {
  renderWithQuery(<NotificationBell className="" />);
  const before = Number((await bell()).getAttribute("aria-label")!.match(/\d+/)![0]);
  await userEvent.click(await bell());
  const pop = await screen.findByRole("dialog", { name: "Bildirişlər" });
  const first = within(pop)
    .getAllByRole("button")
    .find((b) => b.textContent?.startsWith("Oxunmamış:"))!;
  await userEvent.click(first);
  expect(nav.push).toHaveBeenCalledWith(expect.stringMatching(/^\/packages\/[0-9a-f-]{36}$/));
  expect(screen.queryByRole("dialog", { name: "Bildirişlər" })).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /^Bildirişlər/ })).toHaveAccessibleName(
      `Bildirişlər, ${before - 1} oxunmamış`,
    ),
  );
});

test("'mark all read' clears the count", async () => {
  renderWithQuery(<NotificationBell className="" />);
  await userEvent.click(await bell());
  await userEvent.click(await screen.findByRole("button", { name: "Hamısını oxunmuş et" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /^Bildirişlər/ })).toHaveAccessibleName(
      "Bildirişlər, 0 oxunmamış",
    ),
  );
});
