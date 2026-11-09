"use client";

import type { Schemas } from "@payproof/api-client";
import { ui } from "@payproof/api-client/i18n";
import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { DateTime } from "@/components/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Panel } from "@/components/ui/layout";
import { SkeletonText } from "@/components/ui/skeleton";
import { usePackageAudit } from "../queries";

const SHOWN = 8;

/** Audit events, newest first; long histories collapse to the latest 8. */
export function ActivityList({ events }: { events: Schemas["AuditEvent"][] }) {
  const [all, setAll] = useState(false);
  return (
    <>
      <ol>
        {(all ? events : events.slice(0, SHOWN)).map((e) => (
          <li key={e.id} className="border-border border-b py-2.5 text-sm last:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{e.message}</span>
              {e.package_version && (
                <span className="bg-surface-2 text-text-2 border-border rounded-sm border px-1.5 py-px text-[11px] font-bold">
                  {`v${e.package_version}`}
                </span>
              )}
            </div>
            <div className="text-text-3 text-xs">
              {`${e.actor?.full_name ?? ui.system} · `}
              <DateTime value={e.created_at} />
            </div>
          </li>
        ))}
      </ol>
      {events.length > SHOWN && (
        <Button variant="link" className="px-0" onClick={() => setAll(!all)}>
          {all ? "Daha az göstər" : `Bütün ${events.length} hadisəni göstər`}
        </Button>
      )}
    </>
  );
}

/** Prototype `activityPanel`: history, the internal report, and deleting a never-approved package. */
export function ActivityPanel({
  packageId,
  invoiceNumber,
  report,
  onDelete,
}: {
  packageId: string;
  invoiceNumber: string;
  report: { onClick: () => void; pending: boolean };
  /** Absent when the package may not be deleted (role, or it was approved/exported). */
  onDelete?: () => Promise<void>;
}) {
  const audit = usePackageAudit(packageId);
  const [confirming, setConfirming] = useState(false);
  return (
    <Panel
      title="Fəaliyyət tarixçəsi"
      actions={
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            aria-disabled={report.pending}
            onClick={() => report.pending || report.onClick()}
          >
            <Download aria-hidden />
            Daxili yoxlama hesabatı
          </Button>
          {onDelete && (
            <>
              <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden />
                Paketi sil
              </Button>
              <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title={`${invoiceNumber} paketini silmək?`}
                description={`${invoiceNumber} paketi və ona bağlı açıq tapşırıqlar silinəcək. Audit qeydi saxlanılır. Bu əməliyyat geri qaytarılmır.`}
                confirmLabel="Bəli, sil"
                onConfirm={onDelete}
              />
            </>
          )}
        </div>
      }
    >
      {audit.isPending && <SkeletonText lines={4} />}
      {audit.isError && (
        <div role="alert" className="flex items-center justify-between gap-3">
          <span className="text-danger">{ui.errorTitle}</span>
          <Button variant="outline" onClick={() => audit.refetch()}>
            {ui.retry}
          </Button>
        </div>
      )}
      {audit.data && <ActivityList events={audit.data} />}
    </Panel>
  );
}
