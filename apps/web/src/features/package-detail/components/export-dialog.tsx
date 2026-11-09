"use client";

import type { Schemas } from "@payproof/api-client";
import { actionLabel, documentTypeLabel } from "@payproof/api-client/i18n";
import { Download, Lock } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/layout";
import { useRestoreFocus } from "@/components/ui/restore-focus";
import { StaleBanner } from "@/lib/stale";
import { saveFile, useBoundVersion, useExport } from "../approval";

type Pkg = Schemas["PackageDetail"];

interface Props {
  pkg: Pkg;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConflict: () => void;
}

/** The customer-facing package: current versions only; the invoice is always in it. */
export function ExportDialog({ pkg, open, onOpenChange, onConflict }: Props) {
  const exp = useExport(pkg.id);
  const focus = useRestoreFocus();
  const { seen, newer, rebind } = useBoundVersion(pkg);
  const current = (p: Pkg) => new Set(p.documents.map((d) => d.current.id));
  const [picked, setPicked] = useState(() => current(pkg));
  const invoice = pkg.documents.find((d) => d.type === "invoice")?.current.id;
  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (exp.isPending || newer || !invoice) return;
    exp.mutate(
      {
        expected_version: seen.version,
        expected_requirement_set_version: seen.ruleSet,
        idempotencyKey: seen.key,
        // only versions that are current now; the invoice always
        document_version_ids: [
          invoice,
          ...[...picked].filter((id) => id !== invoice && current(pkg).has(id)),
        ],
      },
      {
        onSuccess: ({ export: record, download }) => {
          const done = `${pkg.invoice_number} v${record.package_version} ixrac edildi.`;
          onOpenChange(false);
          // the export exists either way; a failed download can be repeated from "Manifesti yenidən yüklə"
          saveFile(
            `PayProof_${pkg.invoice_number}_v${record.package_version}.zip`,
            download.url,
          ).then(
            () => toast.success(`${done} Manifest yükləndi.`),
            () =>
              toast.warning(`${done} Fayl yüklənmədi — “Manifesti yenidən yüklə” ilə təkrarlayın.`),
          );
        },
        onError: (error) => error.code === "VERSION_CONFLICT" && onConflict(),
      },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => exp.isPending || onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-overlay fixed inset-0 z-50" />
        <Dialog.Content
          {...focus}
          className="bg-surface border-border shadow-3 fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[min(560px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border"
        >
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
            <div className="px-6 pt-5 pb-3">
              <Dialog.Title className="text-xl font-semibold">{`${pkg.invoice_number}: ixrac paketi`}</Dialog.Title>
              <Dialog.Description className="text-text-2 text-sm">
                Müştəriyə göstəriləcək sənədləri seçin. Göndərmə PayProof-dan kənarda aparılır.
              </Dialog.Description>
            </div>
            <div className="flex flex-col gap-3 overflow-auto px-6 pb-4">
              {newer && (
                <StaleBanner
                  version={newer}
                  onRefresh={() => void rebind().then((latest) => setPicked(current(latest)))}
                />
              )}
              {!invoice && (
                <Banner
                  tone="danger"
                  role="alert"
                  title="Paketdə faktura yoxdur — ixrac mümkün deyil."
                />
              )}
              <fieldset className="border-border rounded-md border">
                <legend className="sr-only">Sənədlər</legend>
                {pkg.documents.map((d) => {
                  const invoice = d.type === "invoice";
                  return (
                    <label
                      key={d.id}
                      className="border-border has-focus-visible:ring-ring flex cursor-pointer items-start gap-2 border-b p-3 last:border-b-0 has-disabled:cursor-default has-focus-visible:ring-2"
                    >
                      <input
                        type="checkbox"
                        checked={invoice || picked.has(d.current.id)}
                        disabled={invoice}
                        onChange={() => toggle(d.current.id)}
                        className="accent-brand mt-0.5 size-4 shrink-0 pointer-coarse:size-6"
                      />
                      <span>
                        <b className="text-sm">{`${documentTypeLabel[d.type]} · v${d.current.version_no}`}</b>
                        <span className="text-text-3 block text-xs break-all">
                          {invoice
                            ? `${d.current.file_name} · təsdiqlənmiş versiya, məcburidir`
                            : d.current.file_name}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <Banner tone="neutral" icon={Lock} title="Daxili məlumatlar paketə daxil deyil">
                Daxili AI izahları, əməkdaş şərhləri və audit qeydləri xarici paketə avtomatik əlavə
                olunmur. Daxili yoxlama hesabatı ayrıca yüklənə bilər.
              </Banner>
            </div>
            <div className="border-border flex flex-wrap justify-end gap-2 border-t px-6 py-4">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" size="lg">
                  {actionLabel.cancel}
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                size="lg"
                aria-disabled={exp.isPending || Boolean(newer) || !invoice}
              >
                <Download aria-hidden />
                {exp.isPending ? "İxrac olunur…" : "İxrac et və manifesti yüklə"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
