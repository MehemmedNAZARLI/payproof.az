"use client";

import { Document, Page, pdfjs } from "react-pdf";
import { ui } from "@payproof/api-client/i18n";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// pdf.js parses in a worker; the file comes from the exact pdfjs-dist version react-pdf uses
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** One PDF page (no text/annotation layers: the overlay is ours). Loaded client-only. */
export default function PdfPage({
  url,
  page,
  width,
  onRetry,
}: {
  url: string;
  page: number;
  width: number;
  /** A failed load is often an expired signed link: fetch a fresh one. */
  onRetry: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div role="alert" className="flex items-center justify-between gap-3 p-4 text-sm">
        <span className="text-danger">Faylı açmaq alınmadı — sitata baxın.</span>
        <Button
          variant="outline"
          onClick={() => {
            setFailed(false);
            onRetry();
          }}
        >
          {ui.retry}
        </Button>
      </div>
    );
  return (
    <Document file={url} onLoadError={() => setFailed(true)} loading={null}>
      <Page
        pageNumber={page}
        width={width}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={null}
      />
    </Document>
  );
}
