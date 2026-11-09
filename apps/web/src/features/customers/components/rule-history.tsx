"use client";

import { formatDate } from "@payproof/api-client/format";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { SkeletonText } from "@/components/ui/skeleton";
import { useRequirementHistory } from "../queries";

const yesNo = (v: boolean) => (v ? "bəli" : "xeyr");

/** Immutable rule set versions, newest first; fetched when opened. */
export function RuleHistory({ customerId, count }: { customerId: string; count: number }) {
  const [open, setOpen] = useState(false);
  const history = useRequirementHistory(customerId, open);
  return (
    <details className="group" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="text-text-2 flex cursor-pointer list-none items-center gap-1 py-1 text-sm font-semibold">
        <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
        {`Versiya tarixçəsi (${count})`}
      </summary>
      {history.isPending && open && <SkeletonText lines={2} />}
      {history.isError && (
        <p role="alert" className="text-danger text-sm">
          {history.error.message}
        </p>
      )}
      <ol className="mt-1">
        {history.data?.map((r) => (
          <li key={r.id} className="border-border flex gap-2 border-t py-2 text-sm">
            <span className="bg-surface-2 border-border h-fit rounded-sm border px-1.5 text-[11px] font-bold">{`v${r.version}`}</span>
            <div>
              <b>{formatDate(r.effective_from)}</b>
              {` · ${r.approved_by.full_name}`}
              <div className="text-text-3 text-xs">{r.reason}</div>
              <div className="text-text-3 text-xs">
                {`PO: ${yesNo(r.require_po)} · Təhvil: ${yesNo(r.require_delivery)} · İmza: ${yesNo(r.require_signature)} · Tolerans: ${r.tolerance.replace(".", ",")}`}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
