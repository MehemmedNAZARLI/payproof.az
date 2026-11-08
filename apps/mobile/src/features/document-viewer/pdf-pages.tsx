"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import type { Schemas } from "@/lib/api";
import { t } from "@/lib/i18n";

import { BboxHighlight } from "./viewer-parts";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// iOS Safari blanks canvases above ~16.7 MP; keep a zoomed A4 page under that.
const MAX_CANVAS_PIXELS = 16_000_000;
const A4_RATIO = 1.414;

export function pixelRatio(width: number, device = globalThis.devicePixelRatio ?? 1) {
  const fit = Math.sqrt(MAX_CANVAS_PIXELS / (width * width * A4_RATIO));
  return Math.max(1, Math.min(device, fit));
}

type PdfPagesProps = {
  url: string;
  width: number;
  evidence: Schemas["Evidence"] | null;
  onLoad: () => void;
  onError: () => void;
};

// shortcut: every page renders at once (no virtualisation); fine for 1–3 page invoices, revisit
// with M-12 if long PDFs arrive. A PDF from a signed link, every page fitted to `width`. Evidence with a bbox is outlined on
// its page; without one the viewer shows page and quote instead (never a guessed region).
export default function PdfPages({ url, width, evidence, onLoad, onError }: PdfPagesProps) {
  const [pages, setPages] = useState(0);
  const bbox = evidence?.bbox;
  return (
    <Document
      file={url}
      loading={null}
      error={null}
      onLoadSuccess={({ numPages }) => {
        setPages(numPages);
        onLoad();
      }}
      onLoadError={onError}
      className="flex flex-col items-center gap-3"
    >
      {Array.from({ length: pages }, (_, i) => (
        <div
          key={i}
          data-zoom-page
          role="img"
          aria-label={`${t.evidence.page(i + 1)} / ${pages}`}
          className="relative overflow-hidden rounded-[4px] bg-white shadow-[0_2px_10px_rgb(0_0_0/0.12)]"
        >
          <Page
            pageNumber={i + 1}
            width={width}
            devicePixelRatio={pixelRatio(width)}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={<div style={{ width, height: width * A4_RATIO }} />}
          />
          {bbox && evidence.page === i + 1 && <BboxHighlight bbox={bbox} />}
        </div>
      ))}
    </Document>
  );
}
