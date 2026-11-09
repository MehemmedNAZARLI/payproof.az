import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";
import { mockToken } from "@/test/mock";

import { PackageDetailScreen } from "./package-detail-screen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const id = (n: number) => `0193a000-0000-7000-8002-00000000${n}`;

function open(pkg: number, user = "u2") {
  startSession({
    access_token: mockToken(user),
    token_type: "bearer",
    expires_in: 60,
    user: {} as never,
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <PackageDetailScreen id={id(pkg)} />
    </QueryClientProvider>,
  );
}

describe("PackageDetailScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // TanStack's onlineManager remembers the last event, not navigator.onLine.
    window.dispatchEvent(new Event("online"));
  });
  it("shows the summary, every check, the documents and the missing delivery note", async () => {
    open(1042);
    expect(await screen.findByRole("heading", { level: 1, name: "INV-1042" })).toBeVisible();
    expect(screen.getByText("12.000,00 AZN")).toBeVisible();
    expect(screen.getByText("Order selection pending")).toBeVisible();
    const checks = within(screen.getByRole("list", { name: "Checks" })).getAllByRole("listitem");
    expect(checks).toHaveLength(9);
    expect(checks[0]).toHaveTextContent("R-001 · Failed");
    const docs = within(screen.getByRole("list", { name: "Documents" }));
    expect(docs.getByText("Invoice · v1")).toBeVisible();
    expect(docs.getByText("Delivery document missing")).toBeVisible();
    expect(screen.getByText("Approval unavailable")).toBeVisible();
    expect(screen.getByText(/3 blocking issues/)).toHaveTextContent("R-001, R-002, R-007");
  });

  it("offers approval to the approver of a ready package and makes the operator wait", async () => {
    open(1038);
    expect(
      await screen.findByRole("button", { name: "Review evidence and approve" }),
    ).toBeVisible();
    open(1038, "u1");
    expect(await screen.findByText("Awaiting approver")).toBeVisible();
  });

  it("locks approval plainly while offline", async () => {
    open(1038);
    await screen.findByRole("button", { name: "Review evidence and approve" });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event("offline")));
    const button = await screen.findByRole("button", { name: "Review evidence and approve" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      "No internet connection. Approval requires you to be online.",
    );
  });

  it("lists only open tasks, read-only", async () => {
    open(1044);
    const tasks = within(await screen.findByRole("list", { name: "Open tasks" }));
    expect(tasks.getByText("T-118 · Price mismatch")).toBeVisible();
    expect(tasks.queryByRole("button")).toBeNull();
  });

  it("names the current approver and sends export to the web", async () => {
    open(1035);
    expect(await screen.findByText("Export on web")).toHaveAttribute(
      "href",
      expect.stringMatching(/\/packages\/0193a000-0000-7000-8002-000000001035$/),
    );
    expect(screen.getByText(/Approved by:/)).toBeVisible();
  });

  it("hides checks while the invoice is being read", async () => {
    open(1050);
    expect(await screen.findByText("Processing", { selector: "h3" })).toBeVisible();
    expect(screen.queryByRole("list", { name: "Checks" })).toBeNull();
  });

  it("says when a package does not exist", async () => {
    open(9999);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Package not found" }),
    ).toBeVisible();
  });
});
