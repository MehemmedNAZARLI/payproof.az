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
    const heading = await screen.findByRole("heading", { name: "Paket göndərilməyə hazırdır" });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/-lik faktura paketi \(INV-1035, v\d\)/)).toBeVisible();
    expect(
      screen.getByText(/ödənişin təmin edildiyi və ya fakturanın ödənildiyi demək deyil/),
    ).toBeVisible();
    expect(screen.getByText("Təsdiqləyən")).toBeVisible();
    expect(screen.getByRole("link", { name: "Veb tətbiqdə ixrac et" })).toHaveAttribute(
      "href",
      expect.stringContaining("/packages/0193a000-0000-7000-8002-000000001035"),
    );
    expect(screen.getByRole("link", { name: "Ana səhifəyə qayıt" })).toHaveAttribute(
      "href",
      "/home",
    );
  });

  it("never claims an approval the package does not have", async () => {
    open(1042);
    expect(await screen.findByText("Bu paket üçün qüvvədə olan təsdiq yoxdur")).toBeVisible();
    expect(screen.queryByText("Paket göndərilməyə hazırdır")).toBeNull();
  });
});
