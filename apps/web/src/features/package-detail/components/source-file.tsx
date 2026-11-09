"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { SkeletonBar, Loading } from "@/components/ui/skeleton";
import { useDocumentFile } from "../queries";

// react-pdf needs the DOM (canvas, worker): never part of the server bundle
const PdfPage = dynamic(() => import("./pdf-page"), { ssr: false });
const WIDTH = 680;

type BBox = number[] | null;

/** Normalised [x, y, w, h] (0..1) → a box positioned in percent over the page. */
export const bboxStyle = ([x, y, w, h]: number[]): CSSProperties => ({
  left: `${x! * 100}%`,
  top: `${y! * 100}%`,
  width: `${w! * 100}%`,
  height: `${h! * 100}%`,
});

const Highlight = ({ bbox }: { bbox: BBox }) =>
  bbox ? (
    <div
      data-testid="bbox"
      aria-hidden
      className="bg-paper-hl/40 ring-paper-hl-ring absolute rounded-sm ring-2"
      style={bboxStyle(bbox)}
    />
  ) : null;

export function ImageSource({
  url,
  fileName,
  bbox,
}: {
  url: string;
  fileName: string;
  bbox: BBox;
}) {
  return (
    <div className="relative w-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link, not a static asset */}
      <img src={url} alt={fileName} className="block w-full" />
      <Highlight bbox={bbox} />
    </div>
  );
}

/**
 * The real file of a document version (non-mock mode): a short-lived signed link, then the PDF
 * page or the scanned image, with the evidence box over it when coordinates are known.
 */
export function SourceFile({
  versionId,
  fileName,
  page,
  bbox,
}: {
  versionId: string;
  fileName: string;
  page: number;
  bbox: BBox;
}) {
  const link = useDocumentFile(versionId);
  if (link.isPending)
    return (
      <Loading>
        <SkeletonBar className="h-96 w-full" />
      </Loading>
    );
  if (link.isError)
    return (
      <p role="alert" className="text-danger text-sm">
        {link.error.message}
      </p>
    );
  // pdf.js only reads PDFs; scans arrive as images (png, jpg, webp …)
  if (!/\.pdf$/i.test(fileName))
    return <ImageSource url={link.data.url} fileName={fileName} bbox={bbox} />;
  return (
    <div className="border-border w-fit max-w-full overflow-auto rounded-sm border">
      {/* the page's own box: the highlight's percentages must follow the page, not the scroll box */}
      <div className="relative w-fit">
        <PdfPage url={link.data.url} page={page} width={WIDTH} onRetry={() => link.refetch()} />
        <Highlight bbox={bbox} />
      </div>
    </div>
  );
}
