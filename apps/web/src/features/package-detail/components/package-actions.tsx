import type { Schemas } from "@payproof/api-client";
import { actionLabel } from "@payproof/api-client/i18n";
import { Check, Download, FileText, Lock, RefreshCw, Upload, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { detailText as t } from "../texts";

// Inert, not `disabled`: it stays focusable, so the reason (title → description) can be read.
export const Inert = ({
  icon: Icon,
  label,
  reason,
  primary = false,
  size = "lg",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  reason: string;
  primary?: boolean;
  size?: "lg" | "sm";
  /** Explains on click (e.g. a toast); the action itself never runs. */
  onClick?: () => void;
}) => (
  <Button
    variant={primary ? "default" : "outline"}
    size={size}
    aria-disabled="true"
    title={reason}
    onClick={(e) => {
      e.preventDefault();
      onClick?.();
    }}
    className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
  >
    <Icon aria-hidden />
    {label}
  </Button>
);

/** What the header can do next; an absent callback means the role or state does not allow it. */
export interface ApprovalActions {
  onApprove?: () => void;
  onExport?: () => void;
  onReExport: () => void;
  onReport: () => void;
  /** A one-off download (manifest, report) is running. */
  pending: boolean;
}

/** Header actions by status (prototype `pgPackage`). */
export function PackageActions({
  status,
  recheck,
  onUpload,
  approval,
}: {
  status: Schemas["PackageStatus"];
  /** Re-run the rules on the current version (live since W-10). */
  recheck: { onClick: () => void; pending: boolean };
  /** Absent: the role may not upload (the server checks it again). */
  onUpload?: () => void;
  approval: ApprovalActions;
}) {
  const primary =
    status === "READY_FOR_APPROVAL" ? (
      approval.onApprove ? (
        <Button size="lg" onClick={approval.onApprove}>
          <Check aria-hidden />
          {actionLabel.confirm}
        </Button>
      ) : (
        // visible and explained: the operator learns who approves instead of finding nothing
        <Inert
          primary
          icon={Lock}
          label={actionLabel.confirm}
          reason={t.approverOnly}
          onClick={() => toast.warning(t.approverOnly)}
        />
      )
    ) : status === "APPROVED_READY" ? (
      approval.onExport ? (
        <Button size="lg" onClick={approval.onExport}>
          <Download aria-hidden />
          {t.export}
        </Button>
      ) : (
        <Inert primary icon={Download} label={t.export} reason={t.noExport} />
      )
    ) : status === "EXPORTED" ? (
      <Button
        variant="outline"
        size="lg"
        aria-disabled={approval.pending}
        onClick={() => approval.pending || approval.onReExport()}
      >
        <Download aria-hidden />
        {t.reExport}
      </Button>
    ) : (
      <Inert
        primary
        icon={Lock}
        label={actionLabel.confirm}
        reason={status === "PROCESSING" ? t.stillProcessing : t.blocked}
      />
    );
  return (
    <>
      <Button
        variant="outline"
        size="lg"
        aria-disabled={recheck.pending}
        onClick={() => recheck.pending || recheck.onClick()}
      >
        <RefreshCw
          aria-hidden
          className={recheck.pending ? "motion-safe:animate-spin" : undefined}
        />
        {recheck.pending ? "Yoxlanılır…" : t.recheck}
      </Button>
      {onUpload ? (
        <Button variant="outline" size="lg" onClick={onUpload}>
          <Upload aria-hidden />
          {t.upload}
        </Button>
      ) : (
        <Inert icon={Upload} label={t.upload} reason={t.noEdit} />
      )}
      <Button
        variant="outline"
        size="lg"
        aria-disabled={approval.pending}
        onClick={() => approval.pending || approval.onReport()}
      >
        <FileText aria-hidden />
        {t.report}
      </Button>
      {primary}
    </>
  );
}
