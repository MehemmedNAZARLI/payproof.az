import { mockIds } from "@payproof/mocks";
import { server } from "@payproof/mocks/node";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { OverviewScreen } from "./overview-screen";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

test("attention table: longest open problem first, with status, blockers, amount and days", async () => {
  renderWithQuery(<OverviewScreen />);
  const panel = await screen.findByRole("region", { name: "Diqqət tələb edən paketlər" });
  const table = await within(panel).findByRole("table", { name: "Diqqət tələb edən paketlər" });
  const first = within(table).getAllByRole("row")[1]!;
  expect(within(first).getByRole("link", { name: "INV-1042" })).toHaveAttribute(
    "href",
    `/packages/${mockIds.pkg("pkg_1042")}`,
  );
  expect(within(first).getAllByRole("cell").at(-1)).toHaveTextContent(/^5$/); // = dashboard "longest"
  expect(within(first).getByText(/R-00\d/)).toBeInTheDocument();
  expect(within(panel).getByRole("link", { name: /Hamısı/ })).toHaveAttribute("href", "/packages");
});

test("approval history: version, amount, approver and validity", async () => {
  renderWithQuery(<OverviewScreen />);
  const panel = await screen.findByRole("region", { name: "Təsdiq tarixçəsi" });
  const items = within(panel).getAllByRole("listitem");
  expect(items.length).toBeGreaterThan(0);
  expect(items[0]).toHaveTextContent(/INV-\d+ · v\d+ · [\d.]+,\d{2} (AZN|USD)/);
  expect(items[0]).toHaveTextContent(/Rəşad Əliyev/);
  expect(items[0]).toHaveTextContent(/Qüvvədə|Etibarsızlaşıb|İxrac edilib/);
  expect(within(panel).getByRole("link", { name: /Audit/ })).toHaveAttribute("href", "/audit");
});

test("attention table: a failed load can be retried in place", async () => {
  server.use(
    http.get(
      "*/v1/packages",
      () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "Xəta" } }, { status: 500 }),
      { once: true },
    ),
  );
  renderWithQuery(<OverviewScreen />);
  const panel = await screen.findByRole("region", { name: "Diqqət tələb edən paketlər" });
  expect(await within(panel).findByRole("alert")).toHaveTextContent("Məlumat yüklənmədi");
  await userEvent.click(within(panel).getByRole("button", { name: "Yenidən cəhd edin" }));
  expect(await within(panel).findByRole("table")).toBeInTheDocument();
});
