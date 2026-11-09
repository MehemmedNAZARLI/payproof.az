"use client";

import type { Schemas } from "@payproof/api-client";
import { formatDateTime } from "@payproof/api-client/format";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { keepFocusOnPage } from "@/components/ui/restore-focus";
import { useAdvanceTask, useCancelTask } from "../mutations";

type Task = Schemas["Task"];

/** What a submitted task came back as: the system resolves it only when its rule passes. */
function submittedToast(before: Task, after: Task) {
  if (after.status === "RESOLVED")
    return toast.success(`${after.number}: yoxlama keçdi — tapşırıq həll edildi.`);
  if (after.status === "IN_PROGRESS")
    return toast.warning(
      `${after.number}: ${before.rule_id} yoxlaması hələ keçmir — tapşırıq icraya qaytarıldı. Əvvəl sənədi düzəldin.`,
    );
  toast.info(`${after.number} yenidən yoxlamaya göndərildi.`);
}

/**
 * Moves a task forward and cancels it. There is deliberately no "resolve" action: only the
 * system sets RESOLVED, when the task's rule passes.
 */
export function TaskActions({ task, canManage }: { task: Task; canManage: boolean }) {
  const advance = useAdvanceTask();
  const cancel = useCancelTask();
  const [confirming, setConfirming] = useState(false);
  const busy = advance.isPending || cancel.isPending;

  if (task.status === "RESOLVED")
    return (
      <span className="text-text-3 text-xs">
        {task.resolved_at && `Həll edildi ${formatDateTime(task.resolved_at)}`}
      </span>
    );
  const next =
    task.status === "OPEN"
      ? { status: "IN_PROGRESS" as const, label: "İcraya götür" }
      : task.status === "IN_PROGRESS"
        ? { status: "SUBMITTED_FOR_RECHECK" as const, label: "Yoxlamaya göndər" }
        : null;
  return (
    <div className="flex items-center justify-end gap-1.5">
      {next ? (
        canManage && (
          <Button
            variant="outline"
            size="sm"
            aria-disabled={busy}
            onClick={() =>
              busy ||
              advance.mutate(
                { task, status: next.status },
                {
                  onSuccess: (after) => {
                    keepFocusOnPage(); // the row may have left the current tab
                    if (next.status === "IN_PROGRESS")
                      toast.info(`${after.number} icraya götürüldü.`);
                    else submittedToast(task, after);
                  },
                },
              )
            }
          >
            {next.label}
          </Button>
        )
      ) : (
        <span className="text-text-3 text-xs">Yoxlama gözlənilir</span>
      )}
      {canManage && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${task.number} tapşırığını ləğv et`}
            title="Ləğv et"
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden />
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={`${task.number} tapşırığını ləğv etmək?`}
            description="Tapşırıq siyahıdan silinəcək; ləğv edilməsi audit jurnalına yazılacaq. Yoxlama nəticəsi dəyişmir."
            confirmLabel="Bəli, ləğv et"
            onConfirm={async () => {
              await cancel.mutateAsync(task);
              toast.success(`${task.number} ləğv edildi.`);
            }}
          />
        </>
      )}
    </div>
  );
}
