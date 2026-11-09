import type { ColumnDef } from "@tanstack/react-table";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { DataTable, type Sort } from "./data-table";

type Row = { id: string; invoice: string; amount: string };
const rows: Row[] = [
  { id: "1", invoice: "INV-1042", amount: "12.000,00 AZN" },
  { id: "2", invoice: "INV-1043", amount: "500,00 USD" },
];
const columns: ColumnDef<Row>[] = [
  // sorting is opt-in: only columns the API can sort by
  { id: "invoice", header: "Faktura", accessorKey: "invoice", enableSorting: true },
  {
    id: "amount",
    header: "Məbləğ",
    accessorKey: "amount",
    meta: { align: "right" },
  },
];
const ui = (sort: Sort | null, onSortChange = vi.fn(), data = rows) => (
  <DataTable
    caption="Faktura paketləri"
    empty="Paket yoxdur"
    {...{ columns, data, sort, onSortChange }}
    getRowId={(r) => r.id}
  />
);
const invoiceHeader = () => screen.getByRole("columnheader", { name: /Faktura/ });

test("renders a captioned table with header and cells", () => {
  render(ui(null));
  expect(
    within(screen.getByRole("table", { name: "Faktura paketləri" })).getAllByRole("row"),
  ).toHaveLength(3);
  expect(screen.getByRole("cell", { name: "12.000,00 AZN" })).toHaveClass("text-right");
});

test("aria-sort reflects the sort; unsortable columns have neither button nor aria-sort", () => {
  const { rerender } = render(ui(null));
  expect(invoiceHeader()).toHaveAttribute("aria-sort", "none");
  const amount = screen.getByRole("columnheader", { name: "Məbləğ" });
  expect(within(amount).queryByRole("button")).toBeNull();
  expect(amount).not.toHaveAttribute("aria-sort");
  rerender(ui({ id: "invoice", desc: true }));
  expect(invoiceHeader()).toHaveAttribute("aria-sort", "descending");
});

test("clicking a header sorts ascending, then flips", async () => {
  const onSortChange = vi.fn();
  const { rerender } = render(ui(null, onSortChange));
  await userEvent.click(screen.getByRole("button", { name: /Faktura/ }));
  expect(onSortChange).toHaveBeenLastCalledWith({ id: "invoice", desc: false });
  rerender(ui({ id: "invoice", desc: false }, onSortChange));
  expect(invoiceHeader()).toHaveAttribute("aria-sort", "ascending");
  await userEvent.click(screen.getByRole("button", { name: /Faktura/ }));
  expect(onSortChange).toHaveBeenLastCalledWith({ id: "invoice", desc: true });
});

test("no rows → the empty slot spans the table", () => {
  render(ui(null, vi.fn(), []));
  expect(screen.getByRole("cell", { name: "Paket yoxdur" })).toHaveAttribute("colspan", "2");
});

test("row click (mouse convenience) ignores clicks on links and buttons inside the row", async () => {
  const onRowClick = vi.fn();
  const linked: ColumnDef<Row>[] = [
    {
      id: "invoice",
      header: "Faktura",
      cell: ({ row }) => <a href={`/p/${row.original.id}`}>{row.original.invoice}</a>,
    },
    { id: "amount", header: "Məbləğ", accessorKey: "amount" },
  ];
  render(
    <DataTable
      caption="c"
      empty=""
      columns={linked}
      data={rows}
      getRowId={(r) => r.id}
      onRowClick={onRowClick}
    />,
  );
  await userEvent.click(screen.getByRole("cell", { name: "500,00 USD" }));
  expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  await userEvent.click(screen.getByRole("link", { name: "INV-1042" }));
  expect(onRowClick).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole("row")[1]).toHaveClass("cursor-pointer");
});

test("row click leaves modified clicks and text selection alone", async () => {
  const onRowClick = vi.fn();
  render(
    <DataTable
      caption="c"
      empty=""
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      onRowClick={onRowClick}
    />,
  );
  const cell = screen.getByRole("cell", { name: "500,00 USD" });
  const user = userEvent.setup(); // one instance, so Control stays held during the click
  await user.keyboard("{Control>}");
  await user.click(cell);
  await user.keyboard("{/Control}");
  const selection = vi
    .spyOn(window, "getSelection")
    .mockReturnValue({ toString: () => "500,00" } as Selection);
  await userEvent.click(cell);
  selection.mockRestore();
  expect(onRowClick).not.toHaveBeenCalled();
});
