"use client";

import { actionLabel, documentTypeLabel } from "@payproof/api-client/i18n";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, fieldInput as input } from "@/components/ui/form-field";
import { Banner } from "@/components/ui/layout";
import { useRestoreFocus } from "@/components/ui/restore-focus";
import { useMe } from "@/features/auth";
import { useCustomers } from "@/features/customers";
import { useAssignableUsers } from "@/features/users";
import { demoFiles } from "@/lib/api";
import { createPackageRequest, follow, waitForJob, type NewPackageInput } from "../new-package";
import { DemoSetPicker } from "./demo-set-picker";

type Slot = "invoice" | "order" | "delivery";
const SLOTS: Slot[] = ["invoice", "order", "delivery"];

export function NewPackageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const focus = useRestoreFocus();
  const customers = useCustomers();
  const users = useAssignableUsers();
  const me = useMe().data;
  const mock = demoFiles();
  // a demo set names its customer; the id is resolved once the customer list has loaded
  const [choice, setCustomer] = useState<{ id?: string; name?: string }>({});
  const customer = choice.id ?? customers.data?.find((c) => c.name === choice.name)?.id ?? "";
  const [owner, setOwner] = useState<string | null>(null);
  const [files, setFiles] = useState<Partial<Record<Slot, File>>>({});
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [shown, setShown] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const ownerId = owner ?? (users.data?.some((u) => u.id === me?.id) ? me!.id : "");

  const create = useMutation({
    mutationFn: async (body: NewPackageInput) => {
      const accepted = await createPackageRequest(body);
      // no package: the job will only report why (e.g. a duplicate invoice)
      return { accepted, failed: accepted.package_id ? null : await waitForJob(accepted.job_id) };
    },
  });

  const errors = {
    customer: customer ? null : "Müştərini seçin.",
    owner: ownerId ? null : "Məsul şəxsi seçin.",
    invoice: files.invoice ? null : "Faktura faylı məcburidir.",
  };
  const show = (e: string | null) => (shown ? e : null);
  const change = (next: Partial<Record<Slot, File>>) => {
    setFiles(next);
    setKey(crypto.randomUUID()); // different files = a different intent
    setRefused(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setShown(true);
    if (errors.customer || errors.owner || errors.invoice || create.isPending) return;
    create.mutate(
      {
        customerId: customer,
        ownerId,
        files: { ...files, invoice: files.invoice! },
        idempotencyKey: key,
      },
      {
        onSuccess: ({ accepted, failed }) => {
          if (!accepted.package_id)
            return setRefused(failed?.error?.message ?? "Paket yaradılmadı.");
          const label = files.invoice!.name.replace(/\.[^.]+$/, "");
          onOpenChange(false);
          router.push(`/packages/${accepted.package_id}`);
          toast.info(`${label} yaradıldı, sənədlər emal olunur…`);
          void follow(client, accepted.job_id, accepted.package_id, label);
        },
      },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => create.isPending || onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-overlay fixed inset-0 z-50" />
        <Dialog.Content
          {...focus}
          className="bg-surface border-border shadow-3 fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[min(620px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border"
        >
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
            <div className="px-6 pt-5 pb-3">
              <Dialog.Title className="text-xl font-semibold">Yeni faktura paketi</Dialog.Title>
              <Dialog.Description className="text-text-2 text-sm">
                Müştərini və sənəd dəstini seçin. Sistem faylları emal edib sahələri çıxaracaq.
              </Dialog.Description>
            </div>
            <div className="flex flex-col gap-3 overflow-auto px-6 pb-4">
              {mock && (
                <DemoSetPicker
                  invoice={files.invoice?.name}
                  onPick={(name, picked) => {
                    setCustomer({ name });
                    change(picked);
                  }}
                />
              )}
              <Field label="Müştəri" error={show(errors.customer)}>
                {(id, d) => (
                  <select
                    id={id}
                    value={customer}
                    onChange={(e) => setCustomer({ id: e.target.value })}
                    aria-invalid={Boolean(show(errors.customer)) || undefined}
                    aria-describedby={d}
                    className={input}
                  >
                    <option value="">Seçin…</option>
                    {customers.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {SLOTS.map((slot) => (
                <Field
                  key={slot}
                  label={
                    slot === "invoice"
                      ? `${documentTypeLabel[slot]} (məcburi)`
                      : `${documentTypeLabel[slot]} (istəyə bağlı)`
                  }
                  error={slot === "invoice" ? show(errors.invoice) : null}
                  hint={files[slot]?.name}
                >
                  {(id, d) => (
                    <input
                      id={id}
                      type="file"
                      accept="application/pdf,image/*,.xlsx,.csv"
                      onChange={(e) => change({ ...files, [slot]: e.target.files?.[0] })}
                      aria-invalid={
                        (slot === "invoice" && Boolean(show(errors.invoice))) || undefined
                      }
                      aria-describedby={d}
                      className={input}
                    />
                  )}
                </Field>
              ))}
              <Field label="Məsul şəxs" error={show(errors.owner)}>
                {(id, d) => (
                  <select
                    id={id}
                    value={ownerId}
                    onChange={(e) => setOwner(e.target.value)}
                    aria-invalid={Boolean(show(errors.owner)) || undefined}
                    aria-describedby={d}
                    className={input}
                  >
                    <option value="">Seçin…</option>
                    {users.data?.map((u) => (
                      <option key={u.id} value={u.id}>{`${u.full_name} — ${u.title}`}</option>
                    ))}
                  </select>
                )}
              </Field>
              {refused && (
                <Banner tone="warning" role="alert" title={refused}>
                  Təkrar paket yaradılmadı.
                </Banner>
              )}
            </div>
            <div className="border-border flex flex-wrap justify-end gap-2 border-t px-6 py-4">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" size="lg">
                  {actionLabel.cancel}
                </Button>
              </Dialog.Close>
              <Button type="submit" size="lg" aria-disabled={create.isPending}>
                <Upload aria-hidden />
                {create.isPending ? "Göndərilir…" : "Paketi yarat və emal et"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
