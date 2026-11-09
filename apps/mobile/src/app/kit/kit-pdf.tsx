"use client";

import { lazy, Suspense, useMemo, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fitWidth } from "@/features/document-viewer/viewer-parts";
import { ZoomPane } from "@/features/document-viewer/zoom-pane";

import { SAMPLE_PAGES, samplePdf } from "./sample-pdf";

const PdfPages = lazy(() => import("@/features/document-viewer/pdf-pages"));

// The total line on the sample invoice, as a normalised bbox (what the real API sends).
const TOTAL = {
  document_version_id: "sample",
  page: 1,
  quote: "Total",
  bbox: [0.085, 0.205, 0.36, 0.024],
};

// The real-API path of the document viewer (pdf.js, bbox outline) on a PDF built in the page.
export function PdfSection() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState("…");
  const url = useMemo(
    () =>
      typeof window === "undefined"
        ? ""
        : URL.createObjectURL(new Blob([samplePdf(SAMPLE_PAGES)], { type: "application/pdf" })),
    [],
  );
  return (
    <>
      <SectionHeader title="PDF viewer" />
      <Card className="flex items-center justify-between gap-3">
        <span className="text-text-2 text-footnote">2 pages · source highlight · {state}</span>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          View PDF
        </Button>
      </Card>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Sample PDF"
        description="sample.pdf"
        size="large"
      >
        <ZoomPane label="Sample PDF: document pages">
          {({ width, scale }) => (
            <Suspense fallback={<Skeleton className="h-96 rounded-md" />}>
              <PdfPages
                url={url}
                width={fitWidth(width) * scale}
                evidence={TOTAL}
                onLoad={() => setState("loaded")}
                onError={() => setState("error")}
              />
            </Suspense>
          )}
        </ZoomPane>
      </BottomSheet>
    </>
  );
}
