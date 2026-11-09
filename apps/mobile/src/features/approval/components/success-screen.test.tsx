import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";
import { meFor, mockToken } from "@/test/mock";

import { SuccessScreen } from "./success-screen";

function open(invoice: number) {
  startSession({
    access_token: mockToken("u2"),
    token_type: "bearer",
    expires_in: 60,
    user: meFor("u2"),
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SuccessScreen id={`0193a000-0000-7000-8002-00000000${invoice}`} />
    </QueryClientProvider>,
  );
}

describe("SuccessScreen", () => {
  it("states the outcome, that it is not a payment, and who approved what", async () => {
    open(1035);
    const heading = await screen.findByRole("heading", { name: "Package ready to send" });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/-lik faktura the package \(INV-1035, v\d\)/)).toBeVisible();
    expect(
      screen.getByText(/ödənişin təmin edildiyi və ya fakturanın ödənildiyi demək deyil/),
    ).toBeVisible();
    expect(screen.getByText("Approved by")).toBeVisible();
    expect(screen.getByRole("link", { name: "Export on web" })).toHaveAttribute(
      "href",
      expect.stringContaining("/packages/0193a000-0000-7000-8002-000000001035"),
    );
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/home",
    );
  });

  it("never claims an approval the package does not have", async () => {
    open(1042);
    expect(await screen.findByText("No valid approval for this package")).toBeVisible();
    expect(screen.queryByText("Package ready to send")).toBeNull();
  });
});
