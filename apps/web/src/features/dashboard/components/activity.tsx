"use client";

import type { Schemas } from "@payproof/api-client";
import { bakuDaysBetween } from "@payproof/api-client/format";
import { ui } from "@payproof/api-client/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, CircleCheck, Download, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DateTime, Money } from "@/components/format";
import { PackageStatusBadge, StatusBadge } from "@/components/status/status-badges";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState, Panel } from "@/components/ui/layout";
import { SkeletonTable } from "@/components/ui/skeleton";
import { useAttentionPackages } from "@/features/packages";

type Item = Schemas["PackageListItem"];
type Approval = Schemas["Dashboard"]["recent_approvals"][number];

const More = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link
    href={href}
    className="text-brand inline-flex items-center gap-1 text-sm font-semibold hover:underline pointer-coarse:min-h-11"
  >
    {children}
    <ArrowRight aria-hidden className="size-4" />
  </Link>
);

const attentionColumns = (asOf: string): ColumnDef<Item>[] => [
  {
    id: "invoice",
    header: "Faktura",
    cell: ({ row: { original: p } }) => (
      <>
        <Link
          href={`/packages/${p.id}`}
          className="font-semibold hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          {p.invoice_number}
        </Link>
        <div className="text-text-3 text-xs">{p.customer.name}</div>
      </>
    ),
  },
  {
    id: "problem",
    header: "Problem",
    cell: ({ row: { original: p } }) => (
      <>
        <PackageStatusBadge status={p.status} />
        <div className="text-text-3 mt-0.5 font-mono text-xs">
          {p.blocking.map((b) => b.rule_id).join(", ")}
        </div>
      </>
    ),
  },
  {
    id: "total",
    header: "Məbləğ",
    meta: { align: "right" },
    cell: ({ row: { original: p } }) => p.total && <Money {...p.total} />,
  },
  {
    id: "days",
    header: "Gün",
    meta: { align: "right" },
    cell: ({ row: { original: p } }) => p.problem_since && bakuDaysBetween(p.problem_since, asOf),
  },
];

/** Open problems that waited longest (prototype "Diqqət tələb edən paketlər"). */
export function AttentionPackages({ asOf }: { asOf: string }) {
  const list = useAttentionPackages();
  return (
    <Panel title="Diqqət tələb edən paketlər" actions={<More href="/packages">Hamısı</More>} flush>
      {list.isPending && <SkeletonTable rows={5} columns={4} />}
      {list.isError && (
        <div role="alert" className="flex items-center justify-between gap-3 px-4 pb-4">
          <span className="text-danger">{ui.errorTitle}</span>
          <Button variant="outline" onClick={() => list.refetch()}>
            {ui.retry}
          </Button>
        </div>
      )}
      {list.data && (
        <DataTable
          caption="Diqqət tələb edən paketlər"
          columns={attentionColumns(asOf)}
          data={list.data}
          getRowId={(p) => p.id}
          empty={<EmptyState headingLevel={3} title="Açıq problem yoxdur." />}
        />
      )}
    </Panel>
  );
}

const validity = ({ valid, exported }: Approval) =>
  !valid
    ? { tone: "warning" as const, icon: TriangleAlert, label: "Etibarsızlaşıb" }
    : exported
      ? { tone: "neutral" as const, icon: Download, label: "İxrac edilib" }
      : { tone: "success" as const, icon: CircleCheck, label: "Qüvvədə" };

/** The last approvals, bound to the package version they were given for. */
export function ApprovalHistory({ approvals }: { approvals: Approval[] }) {
  return (
    <Panel title="Təsdiq tarixçəsi" actions={<More href="/audit">Audit</More>}>
      {approvals.length ? (
        <ul>
          {approvals.map((a) => (
            <li
              key={`${a.package.id}-${a.version}`}
              className="border-border flex items-center gap-2.5 border-b py-2.5 text-sm last:border-b-0"
            >
              <div className="min-w-0 grow">
                <Link
                  href={`/packages/${a.package.id}`}
                  className="font-bold hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                >
                  {a.package.invoice_number}
                </Link>
                {` · v${a.version} · `}
                <Money {...a.total} />
                <div className="text-text-3 text-xs">
                  {a.approver.full_name} · <DateTime value={a.approved_at} />
                </div>
              </div>
              <StatusBadge {...validity(a)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-2">Təsdiq yoxdur.</p>
      )}
    </Panel>
  );
}
