import { mockIds } from "@payproof/mocks";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { usePackage } from "../queries";
import { ComparisonPanel } from "./comparison-panel";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

function Of({ id, onEvidence }: { id: string; onEvidence: (...a: unknown[]) => void }) {
  const pkg = usePackage(id).data;
  return pkg ? <ComparisonPanel pkg={pkg} onEvidence={onEvidence} /> : null;
}

test("INV-1044: the unit price differs from the order — icon, colour and words", async () => {
  renderWithQuery(<Of id={mockIds.pkg("pkg_1044")} onEvidence={vi.fn()} />);
  const table = await screen.findByRole("table", { name: "Müqayisə: faktura · sifariş · təhvil" });
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent),
  ).toEqual(["Sahə", "Faktura", "Sifariş", "Təhvil"]);
  expect(
    within(table).getByRole("rowheader", { name: "KY-10 · Kərə yağı 82%, 10 kq blok" }),
  ).toBeInTheDocument();
  const price = within(table).getByRole("cell", { name: /^110,00 AZN.*uyğunsuz/ });
  expect(price).toHaveClass("bg-danger-bg");
  expect(price.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  expect(within(table).getByRole("cell", { name: /^100,00 AZN/ })).not.toHaveClass("bg-danger-bg");
  expect(within(table).getAllByRole("cell", { name: "50" }).length).toBeGreaterThan(0); // quantities formatted
});

test("'Mənbəyə bax' hands the cell's evidence to the viewer", async () => {
  const onEvidence = vi.fn();
  renderWithQuery(<Of id={mockIds.pkg("pkg_1044")} onEvidence={onEvidence} />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Mənbəyə bax: KY-10 Vahid qiymət (Faktura)" }),
  );
  expect(onEvidence).toHaveBeenCalledWith(
    expect.objectContaining({ quote: "Kərə yağı 82%, 10 kq blok — 50 blok × 110,00", page: 1 }),
    "KY-10 Vahid qiymət",
  );
});

test("an unconfirmed order column says so; the two-ways-to-fix note is shown", async () => {
  renderWithQuery(<Of id={mockIds.pkg("pkg_1042")} onEvidence={vi.fn()} />);
  expect(
    await screen.findByRole("columnheader", { name: "Sifariş (təsdiqlənməyib)" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/İki fərqli düzəliş yolu:/)).toBeInTheDocument();
});
