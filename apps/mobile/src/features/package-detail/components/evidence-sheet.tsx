"use client";

import { CheckOutcomeBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ApprovalFooter } from "@/features/approval/components/approval-footer";
import { ApprovalPage } from "@/features/approval/components/approval-page";
import type { ApprovalFlow } from "@/features/approval/use-approval-flow";
import { DocumentViewer } from "@/features/document-viewer/document-viewer";
import type { Schemas } from "@/lib/api";
import { checkMessage, checkTitle } from "@/lib/english";
import { formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";

import type { SheetRoute, useSheetStack } from "../sheet-stack";
import { docIcon } from "./documents-list";

type Detail = Schemas["PackageDetail"];
type Stack = ReturnType<typeof useSheetStack>;

/** The document and version an evidence reference points to (current or an older version). */
function versionOf(pkg: Detail, versionId: string) {
  for (const doc of pkg.documents) {
    const version = [doc.current, ...doc.history].find((v) => v.id === versionId);
    if (version) return { doc, version };
  }
  return undefined;
}

function CheckPage({
  check,
  pkg,
  onEvidence,
}: {
  check: Schemas["CheckResult"];
  pkg: Detail;
  onEvidence: (e: Schemas["Evidence"]) => void;
}) {
  const blocking = check.outcome === "FAIL" || check.outcome === "UNKNOWN";
  return (
    <>
      <p className="text-text-2 text-subhead leading-snug">{checkMessage(check)}</p>
      <h3 className="text-text-3 mt-5 mb-2 text-footnote font-semibold">{t.evidence.source}</h3>
      {check.evidence.length === 0 ? (
        <p className="text-text-3 text-footnote">{t.evidence.none}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {check.evidence.map((e, i) => {
            const found = versionOf(pkg, e.document_version_id);
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onEvidence(e)}
                  className="bg-surface-2 flex min-h-11 w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-[transform,background-color] active:scale-[0.98] active:bg-surface-3"
                >
                  <Icon
                    name={found ? docIcon[found.doc.type] : "file"}
                    size={20}
                    className="text-accent mt-0.5 shrink-0"
                  />
                  <span className="min-w-0 grow">
                    <b className="block text-footnote font-semibold">
                      {found
                        ? `${t.document.type[found.doc.type]} · v${found.version.version_no}`
                        : t.evidence.missingDocument}
                      {" · "}
                      {t.evidence.page(e.page)}
                    </b>
                    <q className="text-text-2 mt-0.5 block font-mono text-caption leading-snug">
                      {e.quote}
                    </q>
                  </span>
                  <Icon name="chev-r" size={18} className="text-text-3 mt-0.5 shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {blocking && <Banner tone="neutral" title={t.evidence.fixOnWeb} className="mt-4" />}
    </>
  );
}

type EvidenceSheetProps = {
  pkg: Detail;
  stack: Stack;
  /** The user saw this document version (only the current version counts towards approval). */
  onViewed: (versionId: string) => void;
  /** The approval review's state, when the user may approve this package. */
  approval?: ApprovalFlow;
};

const noop = () => {};

// One sheet for the evidence trail: a check → the document it cites (highlighted) → back.
export function EvidenceSheet({ pkg, stack, onViewed, approval }: EvidenceSheetProps) {
  const route: SheetRoute | null = stack.shown;
  const check =
    route?.kind === "check" ? pkg.checks.find((c) => c.rule_id === route.ruleId) : undefined;
  const doc =
    route?.kind === "document" ? pkg.documents.find((d) => d.id === route.documentId) : undefined;
  const version =
    doc && route?.kind === "document"
      ? ([doc.current, ...doc.history].find((v) => v.id === route.versionId) ?? doc.current)
      : undefined;
  const reviewing = route?.kind === "approve" && approval !== undefined ? approval : undefined;
  const docTitle = doc && version ? `${t.document.type[doc.type]} · v${version.version_no}` : "";
  const nested = stack.depth > 1;
  const pageKey = route
    ? `${stack.depth}:${route.kind === "check" ? route.ruleId : route.kind === "approve" ? "approve" : route.versionId}`
    : undefined;
  const amount = pkg.total ? formatMoney(pkg.total.amount, pkg.total.currency) : undefined;

  const backButton = (
    <Button
      variant="secondary"
      size="lg"
      block
      icon={nested ? "chev-l" : undefined}
      onClick={nested ? stack.back : stack.close}
    >
      {nested ? t.nav.back : t.common.close}
    </Button>
  );

  return (
    <BottomSheet
      open={
        stack.top !== null && (check !== undefined || doc !== undefined || reviewing !== undefined)
      }
      // An approval on its way keeps the sheet up (swipe springs back), so its answer is seen.
      onClose={reviewing?.pending ? noop : stack.close}
      page={pageKey}
      direction={stack.direction}
      size={doc ? "large" : "auto"}
      title={
        check
          ? checkTitle(check)
          : reviewing
            ? t.approval.title(pkg.invoice_number ?? "")
            : docTitle
      }
      description={
        check
          ? undefined
          : reviewing
            ? [pkg.customer.name, amount].filter(Boolean).join(" · ")
            : version?.file_name
      }
      leading={
        doc && nested ? (
          <button
            type="button"
            onClick={stack.back}
            aria-label={t.nav.back}
            className="text-accent -ml-2 hidden size-11 shrink-0 place-items-center short:grid active:opacity-50"
          >
            <Icon name="chev-l" size={26} strokeWidth={2.2} />
          </button>
        ) : undefined
      }
      footer={reviewing ? <ApprovalFooter flow={reviewing} onClose={stack.close} /> : backButton}
      hideFooterWhenShort={doc !== undefined}
    >
      {check && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <CheckOutcomeBadge outcome={check.outcome} />
            <span className="text-text-3 font-mono text-caption">{check.rule_id}</span>
          </div>
          <CheckPage
            check={check}
            pkg={pkg}
            onEvidence={(e) => {
              const found = versionOf(pkg, e.document_version_id);
              if (found)
                stack.push({
                  kind: "document",
                  documentId: found.doc.id,
                  versionId: found.version.id,
                  evidence: e,
                });
            }}
          />
        </>
      )}
      {reviewing && (
        <ApprovalPage
          pkg={pkg}
          flow={reviewing}
          onOpenDocument={(d) =>
            stack.push({
              kind: "document",
              documentId: d.id,
              versionId: d.current.id,
              evidence: null,
            })
          }
        />
      )}
      {doc && version && route?.kind === "document" && (
        <DocumentViewer
          // A new version (or a re-cited one) starts the viewer afresh.
          key={version.id}
          version={version}
          title={docTitle}
          evidence={route.evidence}
          // Only the current version counts towards "seen"; an older one is context.
          onViewed={() => version.id === doc.current.id && onViewed(version.id)}
        />
      )}
    </BottomSheet>
  );
}
