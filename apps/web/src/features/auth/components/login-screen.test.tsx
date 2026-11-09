import { mockIds } from "@payproof/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { getToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { authKeys } from "../queries";
import { LoginScreen } from "./login-screen";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

test("signs in as the picked demo user and goes to the app", async () => {
  const { client } = renderWithQuery(<LoginScreen />);
  const submit = screen.getByRole("button", { name: "Daxil ol" });
  expect(submit).toBeDisabled();

  const group = await screen.findByRole("radiogroup", { name: "Demo hesabını seçin" });
  const rashad = await screen.findByRole("radio", { name: /Rəşad Əliyev/ });
  expect(group).toContainElement(rashad);
  expect(rashad).toHaveAccessibleName(/Maliyyə direktoru · Təsdiqçi/);
  await userEvent.click(rashad);
  expect(rashad).toBeChecked();
  await userEvent.click(submit);

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  expect(getToken()).toMatch(/^mock\./);
  expect(client.getQueryData(authKeys.me())).toMatchObject({ id: mockIds.user("u2") });
});
