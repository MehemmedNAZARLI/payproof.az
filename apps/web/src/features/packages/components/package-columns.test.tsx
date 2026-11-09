import { mockIds } from "@payproof/mocks";
import { screen, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { DataTable } from "@/components/ui/data-table";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { usePackageList } from "../queries";
import { packageColumns } from "./package-columns";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

function Table({ q }: { q: string }) {
  const items = usePackageList({ q }).data?.items;
  return items ? (
    <DataTable
      caption="Faktura paketləri"
      columns={packageColumns}
      data={items}
      getRowId={(p) => p.id}
      empty=""
    />
  ) : null;
}

test("the invoice cell links to the package and names its PO; blockers are listed", async () => {
  renderWithQuery(<Table q="INV-1042" />);
  const table = await screen.findByRole("table", { name: "Faktura paketləri" });
  const row = within(table).getAllByRole("row")[1]!;
  expect(within(row).getByRole("link", { name: "INV-1042" })).toHaveAttribute(
    "href",
    `/packages/${mockIds.pkg("pkg_1042")}`,
  );
  expect(row).toHaveTextContent(/v\d+ · (PO-\d+|PO oxunmadı|PO yoxdur)/);
  expect(row).toHaveTextContent(/bloklayan: R-00\d/);
});

test("every column is sortable by its API key only when the screen handles sorting", () => {
  expect(packageColumns.map((c) => c.id)).toEqual([
    "invoice_number",
    "customer",
    "invoice_date",
    "total",
    "status",
    "blocking",
    "owner",
    "updated_at",
  ]);
  expect(packageColumns.every((c) => c.enableSorting === true)).toBe(true);
});
