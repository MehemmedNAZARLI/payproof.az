import type { Schemas } from "@payproof/api-client";
import { formatDate, formatDateTime } from "@payproof/api-client/format";
import { ruleShort } from "@payproof/api-client/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import { Clock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { StatusBadge, TaskStatusBadge } from "@/components/status/status-badges";
import { dueState } from "../helpers";
import { TaskActions } from "./task-actions";

type Task = Schemas["Task"];

/** Prototype `taskRows`; actions need the viewer's right to manage tasks. */
export const taskColumns = (canManage: boolean): ColumnDef<Task>[] => [
  {
    id: "number",
    header: "Tapşırıq",
    cell: ({ row: { original: t } }) => (
      <>
        <b>{t.number}</b>
        <div className="text-text-3 text-xs">{formatDateTime(t.created_at)}</div>
      </>
    ),
  },
  {
    id: "problem",
    header: "Problem",
    cell: ({ row: { original: t } }) => (
      <>
        <Link
          href={`/packages/${t.package.id}`}
          className="font-semibold hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          {t.package.invoice_number ?? "—"}
        </Link>
        <div className="text-text-3 text-xs">
          <span className="font-mono">{t.rule_id}</span>{" "}
          {ruleShort[t.rule_id as keyof typeof ruleShort] ?? ""}
        </div>
      </>
    ),
  },
  {
    id: "assignee",
    header: "Məsul",
    cell: ({ row: { original: t } }) => (
      <>
        {t.assignee.full_name}
        <div className="text-text-3 text-xs">{t.assignee.title}</div>
      </>
    ),
  },
  {
    id: "step",
    header: "Tələb olunan addım",
    cell: ({ row: { original: t } }) => (
      <div className="max-w-[340px] text-sm">
        {t.step}
        {t.comment && <div className="text-text-3 text-xs">{`Şərh: ${t.comment}`}</div>}
      </div>
    ),
  },
  {
    id: "due",
    header: "Son tarix",
    cell: ({ row: { original: t } }) => {
      const state = dueState(t.due_date, t.status);
      return (
        <div className="flex flex-col items-start gap-1 text-sm tabular-nums">
          {formatDate(t.due_date)}
          {state === "overdue" && (
            <StatusBadge tone="danger" icon={TriangleAlert} label="Gecikir" />
          )}
          {state === "today" && <StatusBadge tone="warning" icon={Clock} label="Bu gün" />}
        </div>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <TaskStatusBadge status={row.original.status} />,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Əməliyyatlar</span>,
    cell: ({ row }) => <TaskActions task={row.original} canManage={canManage} />,
  },
];
