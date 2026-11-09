import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";
import { meFor, mockToken, notificationsOf } from "@/test/mock";

import { NotificationTabBar } from "./notification-tab-bar";
import { NotificationsScreen } from "./notifications-screen";

vi.mock("next/navigation", () => ({ usePathname: () => "/notifications" }));

function open(user = "u2") {
  startSession({
    access_token: mockToken(user),
    token_type: "bearer",
    expires_in: 60,
    user: meFor(user),
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NotificationsScreen />
      <NotificationTabBar />
    </QueryClientProvider>,
  );
}
const tab = () => screen.getByRole("link", { name: /^Notifications/ });

describe("NotificationsScreen", () => {
  it("groups by day, marks unread ones, and badges the tab", async () => {
    open();
    expect(await screen.findByText("INV-1038 is awaiting your approval · 4.860,00 AZN")).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(1);
    expect(screen.getAllByText("Unread:")).toHaveLength(2);
    expect(screen.getByText("2 unread")).toBeVisible();
    await waitFor(() => expect(tab()).toHaveAccessibleName("Notifications, 2 unread"));
    expect(screen.getByText(/Push notifications P2/)).toBeVisible();
  });

  it("opens the package and marks it read in one tap", async () => {
    open();
    const row = (await screen.findByText(/INV-1038 is awaiting your approval/)).closest("a")!;
    expect(row).toHaveAttribute("href", "/packages/0193a000-0000-7000-8002-000000001038");
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByText("1 unread")).toBeVisible());
    await waitFor(async () => expect((await notificationsOf("u2")).unread_count).toBe(1));
  });

  it("reads everything and clears every badge", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Mark all read" }));
    expect(await screen.findByText("All read")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
    expect(within(tab()).queryByText("2")).toBeNull();
    expect(tab()).toHaveAccessibleName("Notifications");
  });
});
