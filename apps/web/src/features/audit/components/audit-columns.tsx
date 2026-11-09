import type { Schemas } from "@payproof/api-client";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DateTime } from "@/components/format";

type Event = Schemas["AuditEvent"];

/** Prototype `auditRows`: time, who, what, which package version. */
export const auditColumns: ColumnDef<Event>[] = [
  {
    id: "time",
    header: "Vaxt",
    cell: ({ row }) => (
      <span className="text-sm whitespace-nowrap tabular-nums">
        <DateTime value={row.original.created_at} format="datetime" />
      </span>
    ),
  },
  {
    id: "actor",
    header: "İstifadəçi",
    cell: ({ row: { original: e } }) =>
      e.actor ? (
        <>
          {e.actor.full_name}
          <div className="text-text-3 text-xs">{e.actor.title}</div>
        </>
      ) : (
        <span className="text-text-2">Sistem</span>
      ),
  },
  {
    id: "event",
    header: "Hadisə",
    cell: ({ row: { original: e } }) => (
      <div className="max-w-[420px] text-sm">
        {e.message}
        <div className="text-text-3 font-mono text-xs">{e.action}</div>
      </div>
    ),
  },
  {
    id: "package",
    header: "Paket",
    cell: ({ row: { original: e } }) =>
      e.package ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Link
            href={`/packages/${e.package.id}`}
            className="font-semibold hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            {e.package.invoice_number ?? "Paket"}
          </Link>
          {e.package_version && (
            <span className="bg-surface-2 border-border rounded-sm border px-1.5 text-[11px] font-bold">{`v${e.package_version}`}</span>
          )}
        </span>
      ) : (
        "—"
      ),
  },
];
