import { mockIds } from "@payproof/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { setToken } from "@/lib/auth";
import { usePackageList } from "@/features/packages";
import { renderHookWithQuery, renderWithQuery } from "@/test/render";
import { PackageDetailScreen } from "./package-detail-screen";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));
const PKG_1042 = mockIds.pkg("pkg_1042");

test("loading, then breadcrumb and header with the package's key facts", async () => {
  renderWithQuery(<PackageDetailScreen id={PKG_1042} />);
  expect(screen.getByRole("status")).toHaveTextContent("Yüklənir…");
  expect(await screen.findByRole("heading", { level: 1, name: "INV-1042" })).toBeInTheDocument();
  const crumb = screen.getByRole("navigation", { name: "Yol" });
  expect(within(crumb).getByRole("link", { name: "Faktura paketləri" })).toHaveAttribute(
    "href",
    "/packages",
  );
  expect(crumb).toHaveTextContent("INV-1042");
  const meta = screen.getByRole("list", { name: "Paket məlumatları" });
  expect(meta).toHaveTextContent("B Mağazalar Şəbəkəsi");
  expect(meta).toHaveTextContent("Məbləğ: 12.000,00 AZN");
  expect(meta).toHaveTextContent(/Tarix: \d{2}\.\d{2}\.\d{4}/);
  expect(meta).toHaveTextContent(/Qayda dəsti: v\d+/);
  expect(meta).toHaveTextContent("Məsul: Aygün Məmmədova");
  expect(screen.getByText(/^Paket v\d+$/)).toBeInTheDocument();
});

test("a missing package says so and leads back to the list", async () => {
  renderWithQuery(<PackageDetailScreen id="0193a000-0000-7000-8002-000000009999" />);
  expect(await screen.findByRole("heading", { name: "Paket tapılmadı" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Paketlərə qayıt" })).toHaveAttribute(
    "href",
    "/packages",
  );
});

test("the three detail areas sit in one container-query grid (prototype .pd-grid)", async () => {
  renderWithQuery(<PackageDetailScreen id={PKG_1042} />);
  const docs = await screen.findByRole("region", { name: "Sənədlər və versiyalar" });
  const grid = docs.parentElement!;
  expect(grid).toHaveClass("grid");
  expect(within(grid).getByRole("region", { name: "Müqayisə" })).toBeInTheDocument(); // W-09
  expect(within(grid).getByRole("region", { name: "Yoxlamalar" })).toBeInTheDocument(); // W-10
});

test("PROCESSING: only the banner and history, no results yet", async () => {
  const list = renderHookWithQuery(() => usePackageList({ status: ["PROCESSING"] }));
  await waitFor(() => expect(list.result.current.data?.items.length).toBeGreaterThan(0));
  renderWithQuery(<PackageDetailScreen id={list.result.current.data!.items[0]!.id} />);
  await screen.findByRole("region", { name: "Fəaliyyət tarixçəsi" });
  expect(screen.queryByRole("region", { name: "Sənədlər və versiyalar" })).toBeNull();
});

test("INV-1042: the order choice opens from the check card and from the banner", async () => {
  const { default: userEvent } = await import("@testing-library/user-event");
  renderWithQuery(<PackageDetailScreen id={PKG_1042} />);
  const checks = await screen.findByRole("region", { name: "Yoxlamalar" });
  await userEvent.click(within(checks).getAllByRole("button", { name: "Sifarişi seç" })[0]!);
  expect(
    await screen.findByRole("dialog", { name: "INV-1042: sifarişi seçin və təsdiqləyin" }),
  ).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await userEvent.click(screen.getByRole("button", { name: "Bax və təsdiqlə" }));
  expect(
    await screen.findByRole("dialog", { name: "INV-1042: sifarişi seçin və təsdiqləyin" }),
  ).toBeInTheDocument();
});
