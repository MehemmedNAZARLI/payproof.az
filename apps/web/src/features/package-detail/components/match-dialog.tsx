"use client";

import type { Schemas } from "@payproof/api-client";
import { formatDate } from "@payproof/api-client/format";
import { actionLabel, packageStatusLabel } from "@payproof/api-client/i18n";
import { CircleAlert, Link2 } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";
import { Money } from "@/components/format";
import { Button } from "@/components/ui/button";
import { useRestoreFocus } from "@/components/ui/restore-focus";
import { useConfirmMatch } from "../mutations";
import { PaperPage } from "./paper-page";

type Pkg = Schemas["PackageDetail"];

/** The AI suggests order candidates; a person picks one (prototype `mMatch`). */
export function MatchDialog({
  pkg,
  open,
  onOpenChange,
}: {
  pkg: Pkg;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { candidates } = pkg.link;
  const [picked, setPicked] = useState(candidates.length === 1 ? candidates[0]!.order_id : "");
  const [missing, setMissing] = useState(false);
  const confirm = useConfirmMatch(pkg.id);
  const focus = useRestoreFocus();
  const poField = pkg.fields.find((f) => f.field_path === "invoice.po_ref");
  const invoice = pkg.documents.find((d) => d.type === "invoice")?.current;

  const submit = () => {
    if (!picked) return setMissing(true);
    const po = candidates.find((c) => c.order_id === picked)?.po_number;
    confirm.mutate(
      { order_id: picked, expected_version: pkg.version },
      {
        onSuccess: (next) => {
          onOpenChange(false);
          toast.success(
            `${po} ilə əlaqə təsdiqləndi. Paket v${next.version} yenidən yoxlandı: ${packageStatusLabel[next.status]}.`,
          );
        },
      },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => confirm.isPending || onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-overlay fixed inset-0 z-50" />
        <Dialog.Content
          {...focus}
          className="bg-surface border-border shadow-3 fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[min(940px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border"
        >
          <div className="px-6 pt-5 pb-3">
            <Dialog.Title className="text-xl font-semibold">{`${pkg.invoice_number}: sifarişi seçin və təsdiqləyin`}</Dialog.Title>
            <Dialog.Description className="text-text-2 text-sm">
              AI namizədləri ID, məhsul kodu və miqdara görə təklif edir. Seçimi insan edir.
            </Dialog.Description>
          </div>
          <div className="flex flex-col gap-3 overflow-auto px-6 pb-4">
            {candidates.length === 0 ? (
              // nothing to choose from (e.g. a new package): say so instead of an impossible choice
              <p className="bg-surface-2 text-text-2 rounded-md p-3 text-sm">
                Uyğun sifariş namizədi tapılmadı. Sifariş sistemdə qeydə alındıqdan sonra paketi
                yenidən yoxlayın.
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-label="Sifariş namizədləri"
                aria-invalid={missing || undefined}
                aria-describedby={missing ? "match-error" : undefined}
                className="flex flex-col gap-2"
              >
                {candidates.map((c) => (
                  <label
                    key={c.order_id}
                    className="relative border-border has-checked:border-brand has-checked:bg-brand-50 has-focus-visible:ring-ring flex cursor-pointer gap-3 rounded-lg border-[1.5px] p-3 has-focus-visible:ring-2"
                  >
                    <input
                      type="radio"
                      name="candidate"
                      value={c.order_id}
                      checked={picked === c.order_id}
                      onChange={() => {
                        setPicked(c.order_id);
                        setMissing(false);
                      }}
                      className="sr-only"
                    />
                    <span className="grow">
                      <span className="flex flex-wrap justify-between gap-2">
                        <b>{c.po_number}</b>
                        <Money {...c.total} className="font-bold" />
                      </span>
                      <span className="text-text-3 block text-xs">{`${formatDate(c.order_date)} · ${c.reason}`}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {missing && (
              <p
                id="match-error"
                role="alert"
                className="text-danger flex items-center gap-1.5 text-sm"
              >
                <CircleAlert aria-hidden className="size-4" />
                Sifarişlərdən birini seçin.
              </p>
            )}
            <p className="text-text-3 text-xs">
              Semantik oxşarlıq sübut deyil — əlaqəni insan təsdiqləyir.
            </p>
            {process.env.NEXT_PUBLIC_API_MOCK === "1" && invoice && poField?.evidence && (
              <section aria-label="Faktura (mənbə)">
                <h3 className="mb-1 text-sm font-bold">Faktura (mənbə)</h3>
                <PaperPage
                  pkg={pkg}
                  version={invoice}
                  docType="invoice"
                  evidence={poField.evidence}
                />
              </section>
            )}
          </div>
          <div className="border-border flex flex-wrap justify-end gap-2 border-t px-6 py-4">
            <Dialog.Close asChild>
              <Button variant="outline" size="lg">
                {actionLabel.cancel}
              </Button>
            </Dialog.Close>
            {candidates.length > 0 && (
              <Button
                size="lg"
                aria-disabled={confirm.isPending}
                onClick={() => confirm.isPending || submit()}
              >
                <Link2 aria-hidden />
                Seçilmiş sifarişlə əlaqəni təsdiqlə
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
