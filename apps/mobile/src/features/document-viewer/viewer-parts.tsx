"use client";

import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import type { Schemas } from "@/lib/api";
import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n";

import { PAPER_TEXT, PAPER_WIDTH } from "./paper";

// Pieces of the document viewer: notes above the page, the quote shown when a region cannot
// be highlighted, bbox outlines for PDFs and scans, and how pages are sized.

export const Note = ({
  tone,
  icon,
  children,
}: {
  tone: "warning" | "muted";
  icon: "alert" | "info";
  children: ReactNode;
}) => (
  <p
    className={cx(
      "flex items-start gap-1.5 rounded-sm text-xs leading-snug",
      tone === "warning"
        ? "bg-warning-bg text-warning px-2.5 py-1.5"
        : "text-text-3 short:hidden px-0.5",
    )}
  >
    <Icon name={icon} size={14} className="mt-px shrink-0" />
    <span>{children}</span>
  </p>
);

export function QuoteFallback({ evidence }: { evidence: Schemas["Evidence"] }) {
  return (
    <div className="bg-surface-2 rounded-md px-3 py-2">
      <p className="text-text-2 text-xs">{t.viewer.quoteOnly(evidence.page)}</p>
      <q className="text-text mt-1 block font-mono text-xs">{evidence.quote}</q>
    </div>
  );
}

// Opened from a citation, a page starts zoomed so its body text reads at about 12.5px:
// paper is laid out at 480px with 14px text, a PDF page is A4 (595pt) with ~10pt text.
const READABLE_TEXT = 12.5;
const readable = (pageWidth: number, text: number) => (width: number) =>
  READABLE_TEXT / ((text * fitWidth(width)) / pageWidth);
// On a wide screen (landscape, tablet) a page fitted to the full width is too big to read as a
// page; like Preview, it stops growing and sits centred.
const MAX_FIT = 640;
export const fitWidth = (width: number) => Math.min(width, MAX_FIT);
export const PAPER_READABLE = readable(PAPER_WIDTH, PAPER_TEXT);
export const PDF_READABLE = readable(595, 10);

const EDGE = 12;

/** Scroll the pane so the highlighted region is in view: centred, or from its start if wide. */
export function centreHighlight(root: HTMLElement | null) {
  const el = root?.querySelector<HTMLElement>("[data-highlight]");
  const pane = el?.closest<HTMLElement>("[role=region]");
  if (!el || !pane) return;
  const box = el.getBoundingClientRect();
  const view = pane.getBoundingClientRect();
  // A region wider or taller than the pane (a whole table row when zoomed) starts at its
  // leading edge, so its first words are in view; smaller ones sit in the middle.
  const offset = (start: number, size: number, viewStart: number, viewSize: number) =>
    size > viewSize - 2 * EDGE
      ? start - viewStart - EDGE
      : start - viewStart - (viewSize - size) / 2;
  pane.scrollBy({
    top: offset(box.top, box.height, view.top, view.height),
    left: offset(box.left, box.width, view.left, view.width),
  });
}

/** A normalised [x, y, width, height] region outlined on its page. */
export function BboxHighlight({ bbox, pulse = true }: { bbox: number[]; pulse?: boolean }) {
  const [x = 0, y = 0, w = 0, h = 0] = bbox;
  return (
    <div
      data-highlight
      className={cx(
        "bg-paper-hl/40 absolute rounded-[2px] shadow-[0_0_0_2px_var(--paper-hl-ring)]",
        pulse && "animate-[paper-pulse_1.2s_ease-out_2]",
      )}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
      }}
    />
  );
}

type ScanProps = {
  url: string;
  title: string;
  width: number;
  evidence: Schemas["Evidence"] | null;
  onLoad: () => void;
  onError: () => void;
};

export function ScanImage({ url, width, evidence, onLoad, onError, title }: ScanProps) {
  const bbox = evidence?.bbox;
  return (
    <div className="relative mx-auto" style={{ width }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL: nothing for the image optimiser to cache */}
      <img
        src={url}
        alt={title}
        onLoad={onLoad}
        onError={onError}
        className="block w-full rounded-[4px]"
      />
      {bbox && <BboxHighlight bbox={bbox} />}
    </div>
  );
}
