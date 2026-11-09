import { mockIds } from "@payproof/mocks";
import { screen, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { OverviewScreen } from "./overview-screen";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

test("rule bars: most frequent first, each with a text alternative", async () => {
  renderWithQuery(<OverviewScreen />);
  const panel = await screen.findByRole("region", { name: "Problem növləri (qayda üzrə)" });
  const rows = within(panel).getAllByRole("listitem");
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0]).toHaveTextContent(/^R-00\d/);
  // the bar itself is decorative; counts are read as text
  expect(rows[0]).toHaveTextContent(/\d+ uyğunsuz, \d+ naməlum/);
  expect(rows[0]!.querySelector("[aria-hidden='true'] > i")).not.toBeNull();
  const totals = rows.map((r) => Number(r.querySelector("b")!.textContent));
  expect(totals).toEqual([...totals].sort((a, b) => b - a));
  expect(within(panel).getByText("Uyğunsuz (FAIL)")).toBeInTheDocument();
});

test("status donut: described in words, legend links filter the list", async () => {
  renderWithQuery(<OverviewScreen />);
  const panel = await screen.findByRole("region", { name: "Paketlər statusa görə" });
  expect(within(panel).getByRole("img")).toHaveAccessibleName(
    "Status bölgüsü, 14 paket: Düzəliş tələb edir 4, Yoxlama tələb edir 4, Emal olunur 1, Təsdiq gözləyir 2, Göndərilməyə hazır 1, İxrac edilib 2",
  );
  expect(within(panel).getByRole("link", { name: /Düzəliş tələb edir\s*4/ })).toHaveAttribute(
    "href",
    "/packages?status=NEEDS_FIX",
  );
  expect(within(panel).getAllByRole("link")).toHaveLength(6);
});
