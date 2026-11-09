"use client";

import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentFile } from "@/features/package-detail/queries";
import type { Schemas } from "@/lib/api";
import { mockFileVersion } from "@/lib/api/mock-file";
import { t } from "@/lib/i18n";
import { errorMessage } from "@/lib/query-client";

import { Paper, PAPER_WIDTH } from "./paper";
import { pageQuotes } from "./paper-model";
import {
  centreHighlight,
  fitWidth,
  Note,
  PAPER_READABLE,
  PDF_READABLE,
  QuoteFallback,
  ScanImage,
} from "./viewer-parts";
import { ZoomPane } from "./zoom-pane";

// pdf.js is large; only a real PDF loads it.
const PdfPages = lazy(() => import("./pdf-pages"));

type ViewerProps = {
  version: Schemas["DocumentVersion"];
  title: string;
  /** The cited region, when opened from a check's source evidence. */
  evidence: Schemas["Evidence"] | null;
  /** Called once the document is actually on screen (counts as seen). */
  onViewed: () => void;
};

export function DocumentViewer({ version, title, evidence, onViewed }: ViewerProps) {
  const file = useDocumentFile(version.id);
  const url = file.data?.url;
  const mockId = url ? mockFileVersion(url) : null;
  const paper = useQuery({
    queryKey: ["mock-paper", mockId],
    queryFn: () => import("@/lib/mock-paper/paper").then((m) => m.mockPaper(mockId!) ?? null),
    enabled: mockId !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [pdfState, setPdfState] = useState<"loading" | "ready" | "failed">("loading");
  const rootRef = useRef<HTMLDivElement>(null);

  const kind = mockId ? "paper" : version.source_kind;
  const ready =
    kind === "paper" ? Boolean(paper.data) : kind === "spreadsheet" ? false : pdfState === "ready";
  const failed =
    file.isError ||
    (kind === "paper" && (paper.isError || paper.data === null)) ||
    pdfState === "failed";
  // Evidence names its page; only that page can carry the highlight.
  const citedPage = evidence ? paper.data?.pages[evidence.page - 1] : undefined;
  const located =
    evidence !== null &&
    (kind === "paper"
      ? citedPage !== undefined && pageQuotes(citedPage).includes(evidence.quote)
      : evidence.bbox !== null);

  const viewed = useRef(onViewed);
  useEffect(() => {
    viewed.current = onViewed;
  });
  useEffect(() => {
    if (!ready) return;
    viewed.current();
    // After the sheet's page transition has laid the document out.
    const frame = requestAnimationFrame(() => centreHighlight(rootRef.current));
    return () => cancelAnimationFrame(frame);
  }, [ready, evidence?.quote]);

  if (failed)
    return (
      <EmptyState
        icon="alert"
        title={t.viewer.loadFailed}
        description={file.isError ? errorMessage(file.error) : undefined}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setPdfState("loading");
              void file.refetch();
              // refetch() ignores `enabled`; the paper exists only in mock mode.
              if (mockId) void paper.refetch();
            }}
          >
            {t.common.retry}
          </Button>
        }
      />
    );

  return (
    <div ref={rootRef} className="flex flex-col gap-2 short:h-full">
      {version.source_kind === "scan" && (
        <Note tone="warning" icon="alert">
          {t.viewer.scan}
        </Note>
      )}
      {evidence && ready && !located && <QuoteFallback evidence={evidence} />}
      {(!evidence || located) && (
        <Note tone="muted" icon="info">
          {evidence ? t.viewer.highlightHint : t.viewer.currentHint}
        </Note>
      )}
      {kind === "spreadsheet" && url ? (
        <div className="bg-surface-2 rounded-md p-4 text-footnote">
          <p className="text-text-2">{t.viewer.spreadsheet}</p>
          {evidence && <q className="mt-2 block font-mono text-caption">{evidence.quote}</q>}
          <a
            href={url}
            onClick={onViewed}
            className="text-accent mt-2 inline-flex min-h-11 items-center font-semibold"
          >
            {t.viewer.openFile}
          </a>
        </div>
      ) : (
        <div className="short:min-h-0 short:grow">
          {!url || (kind === "paper" && !paper.data) ? (
            <Skeleton className="h-full min-h-64 rounded-md" />
          ) : (
            <ZoomPane
              label={t.viewer.label(title)}
              initialScale={
                located ? (kind === "paper" ? PAPER_READABLE : PDF_READABLE) : undefined
              }
            >
              {({ width, scale }) =>
                kind === "paper" ? (
                  <div
                    className="mx-auto flex w-fit flex-col gap-3"
                    style={{ zoom: (fitWidth(width) / PAPER_WIDTH) * scale }}
                  >
                    {paper.data!.pages.map((page, i) => (
                      <Paper
                        key={page.number}
                        page={page}
                        highlight={evidence && evidence.page === i + 1 ? evidence.quote : null}
                        ariaLabel={`${page.title} ${page.number}`}
                      />
                    ))}
                  </div>
                ) : kind === "scan" ? (
                  <ScanImage
                    url={url}
                    width={fitWidth(width) * scale}
                    evidence={evidence}
                    onLoad={() => setPdfState("ready")}
                    onError={() => setPdfState("failed")}
                    title={title}
                  />
                ) : (
                  <Suspense fallback={<Skeleton className="h-96 rounded-md" />}>
                    <PdfPages
                      url={url}
                      width={fitWidth(width) * scale}
                      evidence={evidence}
                      onLoad={() => setPdfState("ready")}
                      onError={() => setPdfState("failed")}
                    />
                  </Suspense>
                )
              }
            </ZoomPane>
          )}
        </div>
      )}
    </div>
  );
}
