"use client";

import type { Schemas } from "@payproof/api-client";
import { actionLabel, documentTypeLabel, packageStatusLabel } from "@payproof/api-client/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRestoreFocus } from "@/components/ui/restore-focus";
import { dashboardKeys } from "@/features/dashboard";
import { packageKeys } from "@/features/packages";
import { taskKeys } from "@/features/tasks";
import { demoFiles } from "@/lib/api";
import { StaleBanner, usePackageChangedSince } from "@/lib/stale";
import { useJob, useUploadDocument } from "../mutations";
import { samplesFor, stageOf } from "../upload-helpers";
import { FilePicker } from "./upload-file-picker";
import { UploadRefusal, type Refusal } from "./upload-refusal";
import { UploadStages } from "./upload-stages";

type Pkg = Schemas["PackageDetail"];
type UploadType = "invoice" | "delivery";

interface Props {
  pkg: Pkg;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType: UploadType;
}

const newKey = () => crypto.randomUUID();

/** Upload a document (a new version when the package has one): accepted → processed → extracted → checked. */
export function UploadDialog({ pkg, open, onOpenChange, initialType }: Props) {
  const [type, setType] = useState<UploadType>(initialType);
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState(newKey); // one per intent: a retry of the same file reuses it
  const [missing, setMissing] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [jobId, setJobId] = useState<string>();
  const [checked, setChecked] = useState(false);
  const upload = useUploadDocument(pkg.id);
  const job = useJob(jobId);
  const client = useQueryClient();
  const focus = useRestoreFocus();
  const typeId = useId();
  const changed = usePackageChangedSince(pkg.id, pkg.version);
  const mock = demoFiles();
  const doc = pkg.documents.find((d) => d.type === type);
  const existing = pkg.documents.flatMap((d) => [d.current, ...d.history].map((v) => v.file_name));
  const samples = mock ? samplesFor(pkg.invoice_number ?? "", type, existing) : [];
  const status = job.data?.status;
  // polling that cannot reach the job is final too: the dialog must stay closable
  const ended = status === "FAILED" || job.isError;
  const busy = upload.isPending || (Boolean(jobId) && !checked && !ended);

  const choose = (next: File | null) => {
    setFile(next);
    setKey(newKey());
    setMissing(false);
    setRefusal(null);
  };

  useEffect(() => {
    if (status !== "SUCCEEDED") return;
    void Promise.all([
      client.invalidateQueries({ queryKey: packageKeys.all }), // includes this detail
      client.invalidateQueries({ queryKey: dashboardKeys.all }),
      client.invalidateQueries({ queryKey: taskKeys.all }),
    ]).then(() => {
      setChecked(true);
      const next = client.getQueryData<Pkg>(packageKeys.detail(pkg.id));
      onOpenChange(false);
      toast.success(
        next
          ? `${file?.name} yükləndi. Paket v${next.version} yenidən yoxlandı: ${packageStatusLabel[next.status]}.`
          : `${file?.name} yükləndi.`,
      );
    });
    // run once per finished job
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setMissing(true);
    if (busy) return;
    setRefusal(null);
    upload.mutate(
      {
        type,
        file,
        expectedVersion: pkg.version,
        idempotencyKey: key,
        documentId: doc?.id,
      },
      {
        onSuccess: (accepted) => setJobId(accepted.job_id),
        onError: (error) => {
          if (error.code === "DUPLICATE_FILE") setRefusal("duplicate");
          if (error.code === "VERSION_CONFLICT") {
            setRefusal("conflict");
            setKey(newKey()); // a retry after refreshing is a new intent on a new version
          }
        },
      },
    );
  };

  const stage = stageOf({ accepted: Boolean(jobId), job: status, checked });
  return (
    <Dialog.Root open={open} onOpenChange={(o) => busy || onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-overlay fixed inset-0 z-50" />
        <Dialog.Content
          {...focus}
          className="bg-surface border-border shadow-3 fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[min(640px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border"
        >
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
            <div className="px-6 pt-5 pb-3">
              <Dialog.Title className="text-xl font-semibold">{`${pkg.invoice_number ?? "Paket"}: sənəd yüklə`}</Dialog.Title>
              <Dialog.Description className="text-text-2 text-sm">
                Faylın qəbulu, emalı və xətası ayrıca göstərilir.
              </Dialog.Description>
            </div>
            <div className="flex flex-col gap-3 overflow-auto px-6 pb-4">
              {changed && (
                <StaleBanner
                  version={changed}
                  onRefresh={() =>
                    void client.invalidateQueries({ queryKey: packageKeys.detail(pkg.id) })
                  }
                />
              )}
              {jobId ? (
                <UploadStages
                  fileName={file?.name ?? ""}
                  stage={stage}
                  job={job.data}
                  lost={job.isError}
                />
              ) : (
                <>
                  <label htmlFor={typeId} className="text-sm font-semibold">
                    Sənəd növü
                  </label>
                  <select
                    id={typeId}
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value as UploadType);
                      choose(null);
                    }}
                    className="border-border-strong bg-surface focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
                  >
                    {(["invoice", "delivery"] as const).map((t) => (
                      <option key={t} value={t}>
                        {pkg.documents.some((d) => d.type === t)
                          ? `${documentTypeLabel[t]} (yeni versiya)`
                          : documentTypeLabel[t]}
                      </option>
                    ))}
                  </select>
                  <FilePicker
                    samples={samples}
                    mock={mock}
                    file={file}
                    onChoose={choose}
                    invalid={missing}
                  />
                  {missing && (
                    <p role="alert" className="text-danger text-sm">
                      Fayl seçin.
                    </p>
                  )}
                  {refusal && (
                    <UploadRefusal
                      kind={refusal}
                      onRefresh={() => {
                        setRefusal(null);
                        void client.invalidateQueries({ queryKey: packageKeys.detail(pkg.id) });
                      }}
                    />
                  )}
                  <p className="text-text-3 text-xs">
                    Yeni versiya köhnəsini silmir — köhnə versiya audit üçün saxlanılır.
                  </p>
                </>
              )}
            </div>
            <div className="border-border flex flex-wrap justify-end gap-2 border-t px-6 py-4">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" size="lg" aria-disabled={busy}>
                  {actionLabel.cancel}
                </Button>
              </Dialog.Close>
              {!jobId && (
                <Button type="submit" size="lg" aria-disabled={busy}>
                  <Upload aria-hidden />
                  {upload.isPending ? "Göndərilir…" : "Yüklə və emal et"}
                </Button>
              )}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
