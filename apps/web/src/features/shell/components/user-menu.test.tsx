import { mockIds } from "@payproof/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { getToken, setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { UserMenu } from "./user-menu";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

const openMenu = async () => {
  const trigger = await screen.findByRole("button", { name: /Aygün Məmmədova/ });
  trigger.focus();
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("menu");
};

test("switches to another demo account from the keyboard", async () => {
  renderWithQuery(<UserMenu />);
  await openMenu();
  expect(screen.getByRole("menuitemradio", { name: /Aygün Məmmədova/ })).toBeChecked();
  await userEvent.click(screen.getByRole("menuitemradio", { name: /Rəşad Əliyev/ }));
  expect(await screen.findByRole("button", { name: /Rəşad Əliyev/ })).toHaveAccessibleName(
    /Təsdiqçi/,
  );
  expect(getToken()).toBe(`mock.${mockIds.user("u2")}`);
});

test("signs out to the login screen", async () => {
  const { client } = renderWithQuery(<UserMenu />);
  await openMenu();
  await userEvent.click(screen.getByRole("menuitem", { name: "Çıxış" }));
  expect(getToken()).toBeNull();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
});
