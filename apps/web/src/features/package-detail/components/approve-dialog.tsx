"use client";

import type { Schemas } from "@payproof/api-client";
import { formatMoney } from "@payproof/api-client/format";
import { actionLabel, documentTypeLabel } from "@payproof/api-client/i18n";
import { Check, Info } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/layout";
import { useRestoreFocus } from "@/components/ui/restore-focus";
import { StaleBanner } from "@/lib/stale";
import { useApprove, useBoundVersion } from "../approval";

type Pkg = Schemas["PackageDetail"];

const summaryText = ({ pass, fail, unknown, not_applicable }: Pkg["summary"]) =>
  `${pass} keçdi · ${fail} uyğunsuz · ${unknown} naməlum · ${not_applicable} tətbiq olunmur`;

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="border-border flex justify-between gap-4 border-b py-2 text-sm last:border-b-0">
    <span className="text-text-2">{label}</span>
    <b className="text-right">{value}</b>
  </div>
);

interface Props {
  pkg: Pkg;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The package changed under the dialog (409): the parent explains and refreshes. */
  onConflict: () => void;
}

/** "Ready to send" for exactly this version and rule set — never a payment approval. */
export function ApproveDialog({ pkg, open, onOpenChange, onConflict }: Props) {
  const approve = useApprove(pkg.id);
  const focus = useRestoreFocus();
  const { seen, newer, rebind } = useBoundVersion(pkg);
  const [reviewed, setReviewed] = useState(false);
  // after a rebind the package may be blocked: say why instead of offering a doomed approval
  const blocked = !newer && pkg.status !== "READY_FOR_APPROVAL";
  const locked = Boolean(newer) || blocked;
  const [missing, setMissing] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!reviewed) return setMissing(true);
    if (approve.isPending || locked) return;
    approve.mutate(
      {
        expected_version: seen.version,
        expected_requirement_set_version: seen.ruleSet,
        idempotencyKey: seen.key,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success(
            `${pkg.total ? `${formatMoney(pkg.total)}-lik faktura paketi` : "Faktura paketi"} göndərilməyə hazırdır.`,
          );
        },
        onError: (error) => error.code === "VERSION_CONFLICT" && onConflict(),
      },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => approve.isPending || onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-overlay fixed inset-0 z-50" />
        <Dialog.Content
          {...focus}
          className="bg-surface border-border shadow-3 fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[min(560px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border"
        >
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
            <div className="px-6 pt-5 pb-3">
              <Dialog.Title className="text-xl font-semibold">{`${pkg.invoice_number} paketini təsdiqlə`}</Dialog.Title>
              <Dialog.Description className="text-text-2 text-sm">
                {`${pkg.customer.name}${pkg.total ? ` · ${formatMoney(pkg.total)}` : ""}`}
              </Dialog.Description>
            </div>
            <div className="flex flex-col gap-3 overflow-auto px-6 pb-4">
              {newer && (
                <StaleBanner
                  version={newer}
                  onRefresh={() =>
                    // the note was about the old version: review the new one again
                    void rebind().then(() => setReviewed(false))
                  }
                />
              )}
              {blocked && (
                <Banner tone="danger" role="alert" title="Təsdiq mümkün deyil">
                  {pkg.summary.blocking.length
                    ? `Bloklayan yoxlamalar: ${pkg.summary.blocking.map((b) => b.rule_id).join(", ")}.`
                    : "Paket təsdiq gözləyən vəziyyətdə deyil."}
                </Banner>
              )}
              <div className="border-border rounded-md border px-4 py-1">
                <Row label="Cari versiya" value={`v${pkg.version}`} />
                <Row label="Qayda dəsti" value={`v${pkg.requirement_set.version}`} />
                <Row label="Yoxlamalar" value={summaryText(pkg.summary)} />
                <Row
                  label="Sənədlər"
                  value={pkg.documents
                    .map((d) => `${documentTypeLabel[d.type]} v${d.current.version_no}`)
                    .join(" · ")}
                />
              </div>
              <label className="has-focus-visible:ring-ring flex cursor-pointer items-start gap-2 rounded-md text-sm has-focus-visible:ring-2">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => {
                    setReviewed(e.target.checked);
                    setMissing(false);
                  }}
                  aria-invalid={missing || undefined}
                  aria-describedby={missing ? "approve-ack-error" : undefined}
                  className="accent-brand mt-0.5 size-4 shrink-0 pointer-coarse:size-6"
                />
                Cari versiyanın sənədlərinə, mənbə sübutlarına və əvvəlki düzəlişlərə baxdım.
              </label>
              {missing && (
                <p id="approve-ack-error" role="alert" className="text-danger text-sm">
                  Təsdiqdən əvvəl bu qeydi işarələyin.
                </p>
              )}
              <p className="text-text-3 flex gap-1.5 text-xs">
                <Info aria-hidden className="size-4 shrink-0" />
                Bu təsdiq bank ödənişinə səlahiyyət vermir — yalnız sənəd paketinin hazırlığıdır.
              </p>
            </div>
            <div className="border-border flex flex-wrap justify-end gap-2 border-t px-6 py-4">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" size="lg">
                  {actionLabel.cancel}
                </Button>
              </Dialog.Close>
              <Button type="submit" size="lg" aria-disabled={approve.isPending || locked}>
                <Check aria-hidden />
                {approve.isPending ? "Təsdiqlənir…" : actionLabel.confirm}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
