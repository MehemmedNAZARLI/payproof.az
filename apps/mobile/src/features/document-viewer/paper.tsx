import { cx } from "@/lib/cx";

import type { PaperPage, PaperRegion } from "./paper-model";

/** The width a paper page is laid out at; the viewer scales it to the screen like a PDF page. */
export const PAPER_WIDTH = 480;
/** Body text size on the page, before scaling. */
export const PAPER_TEXT = 14;

// The cited region: marker yellow with a ring, pulsing twice when it comes into view.
const HL =
  "bg-paper-hl shadow-[0_0_0_2px_var(--paper-hl-ring)] animate-[paper-pulse_1.2s_ease-out_2]";

function regionProps(quote: string | null, highlight: string | null) {
  const on = quote !== null && quote === highlight;
  return {
    "data-highlight": on || undefined,
    className: cx("rounded-[2px] px-1 py-0.5", on && HL),
  };
}

function Meta({ region, highlight }: { region: PaperRegion; highlight: string | null }) {
  const { className, ...rest } = regionProps(region.quote, highlight);
  return (
    <div className={className} {...rest}>
      {region.label}:{" "}
      <b className={cx("font-semibold", region.unreadable && "blur-[2.4px] select-none")}>
        {region.value}
      </b>
    </div>
  );
}

const SIGNATURE = "M4 28c10-18 16-20 18-8s8 10 14-4 10-6 12 4 10 4 20-8 14 0 30 2";
const RECEIVED = "M6 26c6-14 14-22 16-10s-6 14 6 4 12-12 16 0 14-2 22-10 8 6 36 4";
const Signature = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 110 38"
    aria-hidden="true"
    className="absolute bottom-5 left-1.5 h-9.5 w-27.5 fill-none stroke-[#1f3f8f] stroke-2"
  >
    <path d={d} />
  </svg>
);

type PaperProps = { page: PaperPage; highlight: string | null; ariaLabel: string };

// One page of a document, drawn from extracted data (prototype docPage). Scans get the
// off-white stock and a slight skew, as a photographed sheet would.
export function Paper({ page, highlight, ariaLabel }: PaperProps) {
  const sig = page.signatures;
  return (
    <article
      aria-label={ariaLabel}
      style={{ width: PAPER_WIDTH }}
      className={cx(
        "text-paper-ink border-paper-line relative rounded-[4px] border p-6 text-[14px] leading-[1.45] shadow-[0_2px_10px_rgb(0_0_0/0.12)]",
        page.scan ? "bg-paper-scan -rotate-[0.4deg]" : "bg-paper",
      )}
    >
      <header className="border-paper-ink mb-3 flex justify-between gap-4 border-b-2 pb-2.5">
        <div>
          <b>{page.issuer.name}</b>
          <small className="text-paper-muted block text-[11px]">{page.issuer.detail}</small>
        </div>
        <div className="text-right text-[11px] font-extrabold tracking-[0.06em]">
          {page.title}
          <b className="block text-[15px] tracking-normal">{page.number}</b>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {page.meta.map((r) => (
          <Meta key={r.label} region={r} highlight={highlight} />
        ))}
        {page.notice && <b className="col-span-2 px-1">{page.notice}</b>}
      </div>
      <table className="my-3 w-full border-collapse">
        <thead>
          <tr>
            {page.columns.map((c) => (
              <th
                key={c.text}
                className={cx(
                  "border-paper-line text-paper-muted border-b px-1 py-1.5 text-left text-[11px] font-bold",
                  c.align === "right" && "text-right",
                )}
              >
                {c.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.rows.map((row) => {
            const on = row.quote !== null && row.quote === highlight;
            return (
              <tr
                key={row.cells[0]!.text}
                data-highlight={on || undefined}
                className={cx(on && HL)}
              >
                {row.cells.map((c, i) => (
                  <td
                    key={i}
                    className={cx(
                      "border-paper-line border-b px-1 py-1.5",
                      c.align === "right" && "text-right tabular-nums",
                    )}
                  >
                    {c.text}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {page.total && (
        <div className="flex justify-end">
          <div {...regionProps(page.total.quote, highlight)}>
            <span className="flex gap-4 font-bold">
              <span>{page.total.label}:</span>
              <span className="tabular-nums">{page.total.value}</span>
            </span>
          </div>
        </div>
      )}
      {sig && (
        <div className="mt-5 flex items-end gap-6 text-[11px]">
          <div className="border-paper-ink text-paper-muted relative min-h-12 flex-1 border-t pt-1">
            {sig.delivered}
            <Signature d={SIGNATURE} />
          </div>
          <div {...regionProps(sig.quote, highlight)}>
            <div className="border-paper-ink text-paper-muted relative min-h-12 w-52 border-t pt-1">
              {sig.received}
              {sig.signed ? <Signature d={RECEIVED} /> : <i className="block">— imza yoxdur —</i>}
            </div>
          </div>
        </div>
      )}
      {page.stamp && (
        <div
          aria-hidden="true"
          className="absolute right-7 bottom-10 grid size-18.5 rotate-[-14deg] place-items-center rounded-full border-2 border-[rgb(31_63_143/0.55)] text-center text-[8.5px] font-extrabold tracking-[0.04em] text-[rgb(31_63_143/0.7)]"
        >
          {page.stamp}
          <br />
          MÖHÜR
        </div>
      )}
      <footer className="border-paper-line text-paper-muted mt-3.5 flex justify-between gap-2 border-t border-dashed pt-2 text-[11px]">
        <span>{page.footer.page}</span>
        <span>{page.footer.file}</span>
      </footer>
    </article>
  );
}
