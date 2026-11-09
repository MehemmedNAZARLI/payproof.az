import { mockIds } from "@payproof/mocks";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { Providers } from "@/app/providers";
import { getToken, setToken } from "@/lib/auth";
import { AuthGuard } from "./auth-guard";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
beforeEach(() => replace.mockClear());

const app = () =>
  render(
    <Providers>
      <AuthGuard>gizli məzmun</AuthGuard>
    </Providers>,
  );

test("without a session goes to the login screen", async () => {
  app();
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  expect(screen.queryByText("gizli məzmun")).not.toBeInTheDocument();
});

test("with a valid session renders the app", async () => {
  setToken(`mock.${mockIds.user("u1")}`);
  app();
  expect(await screen.findByText("gizli məzmun")).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

test("401 from the API signs out and goes to the login screen", async () => {
  setToken("mock.expired");
  app();
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  expect(getToken()).toBeNull();
  expect(screen.queryByText("gizli məzmun")).not.toBeInTheDocument();
});
