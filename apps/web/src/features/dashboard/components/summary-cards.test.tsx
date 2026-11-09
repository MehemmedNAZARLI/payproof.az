import { ui } from "@payproof/api-client/i18n";
import { mockIds } from "@payproof/mocks";
import { screen, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { OverviewScreen } from "./overview-screen";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));
const card = (name: string) => screen.findByRole("region", { name });

test("open problem amounts: one row per currency, never summed, with the 'not a loss' note", async () => {
  renderWithQuery(<OverviewScreen />);
  const amounts = await card("Açıq problemli faktura məbləği");
  expect(within(amounts).getByText("29.706,00 AZN")).toBeInTheDocument();
  expect(within(amounts).getByText("AZN · 7 paket")).toBeInTheDocument();
  expect(within(amounts).getByText("1.800,00 USD")).toBeInTheDocument();
  expect(within(amounts).getByText("USD · 1 paket")).toBeInTheDocument();
  expect(within(amounts).getByText(ui.problemAmountHint)).toBeInTheDocument();
});

test("top issue with its invoices, and task progress", async () => {
  renderWithQuery(<OverviewScreen />);
  const top = await card("Ən çox təkrarlanan problem");
  expect(within(top).getByText("PO istinadı")).toBeInTheDocument();
  expect(
    within(top).getByText("4 paketdə: INV-1042, INV-1043, INV-1047, INV-1048"),
  ).toBeInTheDocument();
  expect(within(top).getByText("3 / 9 həll edilib")).toBeInTheDocument();
});

test("problem age: average, the longest package, and the 'not measured yet' note", async () => {
  renderWithQuery(<OverviewScreen />);
  const age = await card("Problemdə qalma müddəti");
  expect(within(age).getByText("3,0 gün")).toBeInTheDocument();
  expect(within(age).getByRole("link", { name: "INV-1042" })).toHaveAttribute(
    "href",
    `/packages/${mockIds.pkg("pkg_1042")}`,
  );
  expect(within(age).getByText(/— 5 gün/)).toBeInTheDocument();
  expect(within(age).getByText(/vaxt qənaəti hələ ölçülməyib/)).toBeInTheDocument();
});
