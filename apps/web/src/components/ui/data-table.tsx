"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TData/TValue are required by the interface
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "right";
  }
}

export type Sort = { id: string; desc: boolean };

const SORTED = {
  asc: { aria: "ascending", Icon: ArrowUp },
  desc: { aria: "descending", Icon: ArrowDown },
  none: { aria: "none", Icon: ArrowUpDown },
} as const;

interface Props<T> {
  /** Accessible table name (visually hidden). */
  caption: string;
  columns: ColumnDef<T>[];
  data: T[];
  getRowId: (row: T) => string;
  /** Sorting is done by the server; the screen keeps it (in the URL) and passes it in. */
  sort?: Sort | null;
  onSortChange?: (sort: Sort) => void;
  /** Shown in a full-width row when there is no data. */
  empty: ReactNode;
  /**
   * Mouse convenience: the whole row opens the item. Keyboard users get the same via a link in the
   * row, so clicks on links and buttons inside the row are left to them.
   */
  onRowClick?: (row: T) => void;
}

/** Prototype `.table`: sortable headers announce their state with `aria-sort`. */
export function DataTable<T>({
  caption,
  columns,
  data,
  getRowId,
  sort = null,
  onSortChange,
  empty,
  onRowClick,
}: Props<T>) {
  // TanStack Table returns non-memoizable functions; React Compiler is off here, nothing to skip.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
  });
  // The server sorts, so TanStack's sorting (which needs accessors) is not used. Opt-in per column:
  // the API sorts by a fixed list of keys (openapi `sort`), any other key would 422.
  const canSort = (enabled?: boolean) => Boolean(onSortChange) && enabled === true;
  const sortedOf = (columnId: string) =>
    sort?.id === columnId ? (sort.desc ? "desc" : "asc") : false;

  return (
    // `relative`: the box must be the containing block of absolutely positioned cell content
    // (sr-only text), or that content escapes the scroll box and widens the whole page.
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const column = header.column;
                const sortable = canSort(column.columnDef.enableSorting);
                const sorted = sortedOf(column.id);
                const label = flexRender(column.columnDef.header, header.getContext());
                const { aria, Icon } = SORTED[sorted || "none"];
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={sortable ? aria : undefined}
                    className={cn(
                      "border-border bg-surface-2 text-text-3 border-b px-4 py-2.5 text-left text-xs font-bold tracking-wide whitespace-nowrap uppercase",
                      column.columnDef.meta?.align === "right" && "text-right",
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSortChange?.({ id: column.id, desc: sorted === "asc" })}
                        className="hover:text-text focus-visible:ring-ring inline-flex min-h-6 items-center gap-1 rounded-sm uppercase outline-none focus-visible:ring-2 pointer-coarse:min-h-11"
                      >
                        {label}
                        <Icon
                          aria-hidden
                          className={cn("size-[13px]", sorted ? "text-brand" : "opacity-55")}
                        />
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={
                onRowClick &&
                ((event) => {
                  const own = (event.target as Element).closest("a, button, input, select, label");
                  const modified =
                    event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;
                  const selecting = Boolean(window.getSelection()?.toString()); // copying text
                  if (!own && !modified && !selecting) onRowClick(row.original);
                })
              }
              className={cn(
                "border-border hover:bg-surface-2 border-b transition-colors duration-base last:border-b-0",
                onRowClick && "cursor-pointer",
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn(
                    "px-4 py-3 align-middle",
                    cell.column.columnDef.meta?.align === "right" && "text-right tabular-nums",
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={table.getVisibleLeafColumns().length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
