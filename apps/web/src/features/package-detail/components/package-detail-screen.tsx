"use client";

import type { Schemas } from "@payproof/api-client";
import { packageStatusLabel, ui } from "@payproof/api-client/i18n";
import { PackageX } from "lucide-react";
import { useIsMutating } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Banner, EmptyState } from "@/components/ui/layout";
import { Loading, SkeletonBar } from "@/components/ui/skeleton";
import { fieldForCheck } from "../correction";
import {
  packageMutationKey,
  useDeletePackage,
  useReviewSignature,
  useValidate,
} from "../mutations";
import { usePackage } from "../queries";
import { detailText as t } from "../texts";
import { CreateTaskDialog } from "@/features/tasks";
import { ActivityPanel } from "./activity-panel";
import { useApprovalFlow } from "./approval-flow";
import { ChecksPanel, type Fixable } from "./checks-panel";
import { ComparisonPanel } from "./comparison-panel";
import { CorrectFieldDialog } from "./correct-field-dialog";
import { DocumentsPanel } from "./documents-panel";
import { EvidenceViewer } from "./evidence-viewer";
import { MatchBanner } from "./match-banner";
import { MatchDialog } from "./match-dialog";
import { PackageActions } from "./package-actions";
import { PackageHeader } from "./package-header";
import { ReadinessBanner } from "./readiness-banner";
import { UploadDialog } from "./upload-dialog";

export function PackageDetailScreen({ id }: { id: string }) {
  const pkg = usePackage(id);
  const [viewing, setViewing] = useState<{
    evidence: Schemas["Evidence"];
    label: string;
    signature?: boolean;
  } | null>(null);
  const [matching, setMatching] = useState(false);
  const approval = useApprovalFlow(pkg.data);
  const [uploading, setUploading] = useState<"invoice" | "delivery" | null>(null);
  const [tasking, setTasking] = useState<Schemas["CheckResult"] | null>(null);
  const [correcting, setCorrecting] = useState<string | null>(null); // field id
  const sign = useReviewSignature(id);
  const validate = useValidate(id);
  const remove = useDeletePackage(id);
  const router = useRouter();
  const busy = useIsMutating({ mutationKey: packageMutationKey(id) });
  // R-008: show the signature evidence; without one, the delivery note's first page (no invented quote)
  const reviewSignature = (p: Schemas["PackageDetail"]) => {
    const check = p.checks.find((c) => c.fix_hint === "review_signature");
    const delivery = p.documents.find((d) => d.type === "delivery")?.current;
    const evidence =
      check?.evidence[0] ??
      (delivery && { document_version_id: delivery.id, page: 1, quote: "", bbox: null });
    if (evidence) setViewing({ evidence, label: "İmza", signature: true });
  };

  const fix = (p: Schemas["PackageDetail"], hint: Fixable, check: Schemas["CheckResult"]) => {
    if (hint === "link_order") return setMatching(true);
    if (hint === "review_signature") return reviewSignature(p);
    if (hint === "upload_delivery") return setUploading("delivery");
    if (hint === "upload_invoice") return setUploading("invoice");
    // edit_field: the field the check's evidence points at (the panel hides the fix when none)
    const field = fieldForCheck(p, check);
    if (field) setCorrecting(field.id);
  };

  if (pkg.isPending)
    return (
      <Loading className="flex flex-col gap-4">
        <SkeletonBar className="h-4 w-48" />
        <SkeletonBar className="h-10 w-80" />
        <SkeletonBar className="h-20 w-full rounded-lg" />
        <SkeletonBar className="h-64 w-full rounded-lg" />
      </Loading>
    );
  if (pkg.isError)
    return pkg.error.status === 404 ? (
      <EmptyState
        icon={PackageX}
        title={t.notFoundTitle}
        description={t.notFoundBody}
        action={
          <Button asChild variant="outline">
            <Link href="/packages">{t.backToList}</Link>
          </Button>
        }
      />
    ) : (
      <Banner
        tone="danger"
        role="alert"
        title={ui.errorTitle}
        actions={
          <Button variant="outline" onClick={() => pkg.refetch()}>
            {ui.retry}
          </Button>
        }
      >
        {pkg.error.message}
      </Banner>
    );

  const canEdit = pkg.data.permissions.can_edit;
  const field = pkg.data.fields.find((f) => f.id === correcting);
  return (
    <div className="@container flex flex-col gap-4">
      <PackageHeader
        pkg={pkg.data}
        actions={
          <PackageActions
            status={pkg.data.status}
            approval={approval.actions}
            onUpload={
              canEdit
                ? () =>
                    setUploading(
                      pkg.data.documents.some((d) => d.type === "delivery")
                        ? "invoice"
                        : "delivery",
                    )
                : undefined
            }
            recheck={{
              pending: busy > 0,
              onClick: () =>
                validate.mutate(
                  { expected_version: pkg.data.version },
                  {
                    onSuccess: (next) =>
                      toast.success(
                        `Paket v${next.version} yenidən yoxlandı: ${packageStatusLabel[next.status]}.`,
                      ),
                  },
                ),
            }}
          />
        }
      />
      <ReadinessBanner pkg={pkg.data} onRefresh={() => pkg.refetch()} />
      <MatchBanner pkg={pkg.data} onReview={() => setMatching(true)} />
      {/* while processing nothing is shown yet (prototype) */}
      {pkg.data.status !== "PROCESSING" && (
        // prototype .pd-grid: 1 column → compare|checks over docs|checks (880 px) → docs|compare|checks (1240 px)
        <div className="grid items-start gap-4 [grid-template-areas:'checks'_'compare'_'docs'] @min-[880px]:grid-cols-[minmax(0,1fr)_360px] @min-[880px]:[grid-template-areas:'compare_checks'_'docs_checks'] @min-[1240px]:grid-cols-[250px_minmax(0,1fr)_360px] @min-[1240px]:[grid-template-areas:'docs_compare_checks']">
          <DocumentsPanel pkg={pkg.data} onUpload={canEdit ? setUploading : undefined} />
          <ComparisonPanel
            pkg={pkg.data}
            onEvidence={(evidence, label) => setViewing({ evidence, label })}
            onCorrect={canEdit ? setCorrecting : undefined}
          />
          <ChecksPanel
            pkg={pkg.data}
            onEvidence={(evidence, label) => setViewing({ evidence, label })}
            canEdit={canEdit}
            onTask={pkg.data.permissions.can_manage_tasks ? setTasking : undefined}
            onFix={(hint, check) => fix(pkg.data, hint, check)}
          />
        </div>
      )}
      <EvidenceViewer
        pkg={pkg.data}
        evidence={viewing?.evidence ?? null}
        label={viewing?.label ?? ""}
        onClose={() => setViewing(null)}
        signature={
          viewing?.signature
            ? {
                pending: sign.isPending,
                onConfirm: () =>
                  sign.mutate(
                    { expected_version: pkg.data.version },
                    {
                      onSuccess: (next) => {
                        setViewing(null);
                        toast.success(
                          `İmzanın mövcudluğu qeyd edildi. Paket: ${packageStatusLabel[next.status]}.`,
                        );
                      },
                    },
                  ),
              }
            : undefined
        }
      />
      {matching && <MatchDialog pkg={pkg.data} open onOpenChange={setMatching} />}
      {approval.dialogs}
      {tasking && (
        <CreateTaskDialog
          pkg={pkg.data}
          check={tasking}
          open
          onOpenChange={(o) => o || setTasking(null)}
        />
      )}
      {uploading && (
        <UploadDialog
          pkg={pkg.data}
          open
          initialType={uploading}
          onOpenChange={(o) => o || setUploading(null)}
        />
      )}
      {field && (
        <CorrectFieldDialog
          pkg={pkg.data}
          field={field}
          open
          onOpenChange={(o) => o || setCorrecting(null)}
          onUploadInstead={() => {
            setCorrecting(null);
            setUploading("invoice");
          }}
        />
      )}
      <ActivityPanel
        packageId={id}
        invoiceNumber={pkg.data.invoice_number ?? "Paket"}
        report={{ onClick: approval.actions.onReport, pending: approval.actions.pending }}
        // can_delete = role AND state (never approved or exported); the server checks again
        onDelete={
          pkg.data.permissions.can_delete
            ? () =>
                remove.mutateAsync({ expected_version: pkg.data.version }).then(() => {
                  router.push("/packages");
                  toast.success(
                    `${pkg.data.invoice_number ?? "Paket"} silindi. Audit qeydi saxlanıldı.`,
                  );
                })
            : undefined
        }
      />
    </div>
  );
}
