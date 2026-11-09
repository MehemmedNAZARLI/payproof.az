import { mockIds } from "@payproof/mocks";
import { server } from "@payproof/mocks/node";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, test } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { OverviewScreen } from "./overview-screen";

beforeEach(() => {
  setToken(`mock.${mockIds.user("u1")}`);
  localStorage.clear();
});

test("loading first, then the header with company, date and package count", async () => {
  renderWithQuery(<OverviewScreen />);
  expect(screen.getByRole("status")).toHaveTextContent("Yüklənir…");
  expect(
    await screen.findByText(
      "A Distribusiya MMC · 8 noyabr 2026 vəziyyəti · 14 unikal faktura paketi",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "İcmal" })).toBeInTheDocument();
});

test("KPI cards open the package list filtered by status", async () => {
  renderWithQuery(<OverviewScreen />);
  const kpis = await screen.findByRole("list", { name: "Əsas göstəricilər" });
  const link = (name: RegExp) => within(kpis).getByRole("link", { name });
  expect(link(/Faktura paketləri\s*14/)).toHaveAttribute("href", "/packages");
  expect(link(/Yoxlama tələb edir\s*4/)).toHaveAttribute("href", "/packages?status=NEEDS_REVIEW");
  expect(link(/Düzəliş tələb edir\s*4/)).toHaveAttribute("href", "/packages?status=NEEDS_FIX");
  expect(link(/Təsdiq gözləyir\s*2/)).toHaveAttribute(
    "href",
    "/packages?status=READY_FOR_APPROVAL",
  );
  expect(within(kpis).getByText("Göndərilməyə hazır: 1 · ixrac edilib: 2")).toBeInTheDocument();
});

test("the intro card can be dismissed and stays closed", async () => {
  const first = renderWithQuery(<OverviewScreen />);
  const intro = await screen.findByRole("region", { name: "Məhsul haqqında" });
  expect(within(intro).getByRole("list", { name: "İş axını" }).children).toHaveLength(5);
  await userEvent.click(screen.getByRole("button", { name: "Təqdimatı bağla" }));
  expect(screen.queryByRole("region", { name: "Məhsul haqqında" })).toBeNull();
  first.unmount();
  renderWithQuery(<OverviewScreen />);
  await screen.findByRole("list", { name: "Əsas göstəricilər" });
  expect(screen.queryByRole("region", { name: "Məhsul haqqında" })).toBeNull();
});

test("a failed load offers a retry", async () => {
  server.use(
    http.get(
      "*/v1/dashboard",
      () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "Xəta" } }, { status: 500 }),
      { once: true },
    ),
  );
  renderWithQuery(<OverviewScreen />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Məlumat yüklənmədi");
  await userEvent.click(screen.getByRole("button", { name: "Yenidən cəhd edin" }));
  expect(await screen.findByRole("list", { name: "Əsas göstəricilər" })).toBeInTheDocument();
});
