"use client";

import { CheckOutcomeBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { DocumentViewer } from "@/features/document-viewer/document-viewer";
import type { Schemas } from "@/lib/api";
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
      <p className="text-text-2 text-md leading-snug">{check.message}</p>
      <h3 className="text-text-3 mt-5 mb-2 text-sm font-semibold">{t.evidence.source}</h3>
      {check.evidence.length === 0 ? (
        <p className="text-text-3 text-sm">{t.evidence.none}</p>
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
                    className="text-brand-600 mt-0.5 shrink-0"
                  />
                  <span className="min-w-0 grow">
                    <b className="block text-sm font-semibold">
                      {found
                        ? `${t.document.type[found.doc.type]} · v${found.version.version_no}`
                        : t.evidence.missingDocument}
                      {" · "}
                      {t.evidence.page(e.page)}
                    </b>
                    <q className="text-text-2 mt-0.5 block font-mono text-xs leading-snug">
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
};

// One sheet for the evidence trail: a check → the document it cites (highlighted) → back.
export function EvidenceSheet({ pkg, stack, onViewed }: EvidenceSheetProps) {
  const route: SheetRoute | null = stack.shown;
  const check =
    route?.kind === "check" ? pkg.checks.find((c) => c.rule_id === route.ruleId) : undefined;
  const doc =
    route?.kind === "document" ? pkg.documents.find((d) => d.id === route.documentId) : undefined;
  const nested = stack.depth > 1;
  const pageKey = route
    ? `${stack.depth}:${route.kind === "check" ? route.ruleId : route.documentId}`
    : undefined;

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
      open={stack.top !== null && (check !== undefined || doc !== undefined)}
      onClose={stack.close}
      page={pageKey}
      direction={stack.direction}
      size={doc ? "large" : "auto"}
      title={
        check ? check.title : doc ? `${t.document.type[doc.type]} · v${doc.current.version_no}` : ""
      }
      description={check ? undefined : doc?.current.file_name}
      leading={
        doc && nested ? (
          <button
            type="button"
            onClick={stack.back}
            aria-label={t.nav.back}
            className="text-brand-600 -ml-2 hidden size-11 shrink-0 place-items-center short:grid active:opacity-50"
          >
            <Icon name="chev-l" size={26} strokeWidth={2.2} />
          </button>
        ) : undefined
      }
      footer={backButton}
      hideFooterWhenShort={doc !== undefined}
    >
      {check && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <CheckOutcomeBadge outcome={check.outcome} />
            <span className="text-text-3 font-mono text-xs">{check.rule_id}</span>
          </div>
          <CheckPage
            check={check}
            pkg={pkg}
            onEvidence={(e) => {
              const found = versionOf(pkg, e.document_version_id);
              if (found) stack.push({ kind: "document", documentId: found.doc.id, evidence: e });
            }}
          />
        </>
      )}
      {doc && route?.kind === "document" && (
        <DocumentViewer
          version={doc.current}
          title={`${t.document.type[doc.type]} · v${doc.current.version_no}`}
          evidence={route.evidence}
          onViewed={() => onViewed(doc.current.id)}
        />
      )}
    </BottomSheet>
  );
}
