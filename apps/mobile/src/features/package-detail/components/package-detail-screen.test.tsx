import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mockToken } from "@/lib/api/mock/handlers";
import { createQueryClient } from "@/lib/query-client";
import { startSession } from "@/lib/session";

import { PackageDetailScreen } from "./package-detail-screen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/lib/api/mock/mock-fetch", async (load) => {
  const real = await load<typeof import("@/lib/api/mock/mock-fetch")>();
  return { createMockFetch: () => real.createMockFetch({ latencyMs: 0 }) };
});

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
  it("shows the summary, every check, the documents and the missing delivery note", async () => {
    open(1042);
    expect(await screen.findByRole("heading", { level: 1, name: "INV-1042" })).toBeVisible();
    expect(screen.getByText("12.000,00 AZN")).toBeVisible();
    expect(screen.getByText("Sifariş seçimi gözlənilir")).toBeVisible();
    const checks = within(screen.getByRole("list", { name: "Yoxlamalar" })).getAllByRole(
      "listitem",
    );
    expect(checks).toHaveLength(9);
    expect(checks[0]).toHaveTextContent("R-001 · Uyğunsuz");
    const docs = within(screen.getByRole("list", { name: "Sənədlər" }));
    expect(docs.getByText("Faktura · v1")).toBeVisible();
    expect(docs.getByText("Təhvil sənədi yoxdur")).toBeVisible();
    expect(screen.getByText("Təsdiq mümkün deyil")).toBeVisible();
    expect(screen.getByText(/3 bloklayan problem/)).toHaveTextContent("R-001, R-002, R-007");
  });

  it("offers approval to the approver of a ready package and makes the operator wait", async () => {
    open(1038);
    expect(await screen.findByRole("button", { name: "Sübutlara baxıb təsdiqlə" })).toBeVisible();
    open(1038, "u1");
    expect(await screen.findByText("Təsdiqçi gözlənilir")).toBeVisible();
  });

  it("lists only open tasks, read-only", async () => {
    open(1044);
    const tasks = within(await screen.findByRole("list", { name: "Açıq tapşırıqlar" }));
    expect(tasks.getByText("T-118 · Qiymət fərqi")).toBeVisible();
    expect(tasks.queryByRole("button")).toBeNull();
  });

  it("names the current approver and sends export to the web", async () => {
    open(1035);
    expect(await screen.findByText("Veb tətbiqdə ixrac et")).toHaveAttribute(
      "href",
      expect.stringMatching(/\/packages\/0193a000-0000-7000-8002-000000001035$/),
    );
    expect(screen.getByText(/Təsdiqləyən:/)).toBeVisible();
  });

  it("hides checks while the invoice is being read", async () => {
    open(1050);
    expect(await screen.findByText("Emal olunur", { selector: "h3" })).toBeVisible();
    expect(screen.queryByRole("list", { name: "Yoxlamalar" })).toBeNull();
  });

  it("says when a package does not exist", async () => {
    open(9999);
    expect(await screen.findByRole("heading", { level: 1, name: "Paket tapılmadı" })).toBeVisible();
  });
});
