import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { getSession, startSession } from "@/lib/session";
import { mockToken } from "@/test/mock";

import { ProfileScreen } from "./profile-screen";

vi.mock("next/navigation", () => ({ usePathname: () => "/profile" }));

function renderAs(token: string) {
  startSession({ access_token: token, token_type: "bearer", expires_in: 60, user: {} as never });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ProfileScreen />
    </QueryClientProvider>,
  );
}

describe("ProfileScreen", () => {
  it("shows who is signed in and what they may do, from /v1/me", async () => {
    renderAs(mockToken("u2"));
    expect(await screen.findByRole("heading", { name: "Rəşad Əliyev" })).toBeInTheDocument();
    expect(screen.getByText("Təsdiqçi")).toBeInTheDocument();
    const perms = within(screen.getByRole("list", { name: "Səlahiyyətlər" }));
    expect(perms.getAllByRole("listitem")).toHaveLength(7);
    expect(perms.getByText("Hazır paketi təsdiqləmək").closest("li")).toHaveTextContent("Bəli");
    expect(perms.getByText("Təsdiqlənməmiş paketi silmək").closest("li")).toHaveTextContent("Xeyr");
  });

  it("does not offer approval to the operator", async () => {
    renderAs(mockToken("u1"));
    const row = (await screen.findByText("Hazır paketi təsdiqləmək")).closest("li");
    expect(row).toHaveTextContent("Xeyr");
  });

  it("signs out only after confirming", async () => {
    renderAs(mockToken("u2"));
    fireEvent.click(screen.getByRole("button", { name: "Hesabdan çıx" }));
    const sheet = await screen.findByRole("dialog", { name: "Hesabdan çıxılsın?" });
    expect(getSession()).not.toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: "Hesabdan çıx" }));
    await waitFor(() => expect(getSession()).toBeNull());
  });
});
