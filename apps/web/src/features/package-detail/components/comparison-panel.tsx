import type { Schemas } from "@payproof/api-client";
import { formatMoney, formatQuantity } from "@payproof/api-client/format";
import { CircleHelp, CircleX, Eye, Info, Pencil, Sparkles } from "lucide-react";
import { Fragment } from "react";
import { Panel } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import { detailText as t } from "../texts";

type Pkg = Schemas["PackageDetail"];
type Row = Schemas["ComparisonRow"];
type Cell = Schemas["ComparisonCell"];
type Column = "invoice" | "order" | "delivery";

/** "lines[KY-10].unit_price" → "KY-10" (the row key, not the display text). */
const lineCode = (key: string) => /^lines\[(.+?)\]/.exec(key)?.[1] ?? "";

const COLUMNS: { key: Column; label: string }[] = [
  { key: "invoice", label: t.comparisonColumns.invoice },
  { key: "order", label: t.comparisonColumns.order },
  { key: "delivery", label: t.comparisonColumns.delivery },
];

/** Decimal strings stay strings: money and quantities go through the shared formatters. */
function display(row: Row, cell: Cell) {
  if (cell.value === null) return cell.state === "unknown" ? "oxunmadı" : "—";
  if (row.key.endsWith(".qty")) return formatQuantity(cell.value);
  if (cell.currency) return formatMoney(cell.value, cell.currency);
  return cell.value;
}

// colour is never the only signal: icon + words (sr-only) go with it
const STATE = {
  mismatch: { cls: "bg-danger-bg text-danger font-semibold", Icon: CircleX, sr: "uyğunsuz" },
  unknown: { cls: "bg-warning-bg text-warning font-semibold", Icon: CircleHelp, sr: "naməlum" },
} as const;

interface Props {
  pkg: Pkg;
  /** Opens the evidence viewer for a cell's source. */
  onEvidence: (evidence: Schemas["Evidence"], label: string) => void;
  /** Opens the correction dialog for an extracted field; absent when the role may not edit. */
  onCorrect?: (fieldId: string) => void;
}

/** Invoice · order · delivery side by side (prototype `comparePanel`). */
export function ComparisonPanel({ pkg, onEvidence, onCorrect }: Props) {
  const caption = t.comparisonCaption;
  // only extracted fields are correctable (order values come from the order system)
  const extracted = new Set(pkg.fields.map((f) => f.id));
  const iconBtn =
    "text-text-3 hover:text-text hover:bg-surface-2 focus-visible:ring-ring inline-grid size-7 place-items-center rounded-sm outline-none focus-visible:ring-2 pointer-coarse:size-11";
  return (
    <Panel
      title={t.comparison}
      flush
      className="[grid-area:compare]"
      actions={
        <span className="bg-surface-2 text-text-2 border-border inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-[11px] font-bold">
          <Sparkles aria-hidden className="size-3" />
          {t.aiSourced}
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-surface-2 text-text-3 text-left text-xs font-bold uppercase">
              <th scope="col" className="px-4 py-2">
                {t.comparisonColumns.field}
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="px-4 py-2">
                  {c.key === "order" && !pkg.link.confirmed ? t.unconfirmed(c.label) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pkg.comparison.rows.map((row, i) => (
              <Fragment key={row.key}>
                {row.group && row.group !== pkg.comparison.rows[i - 1]?.group && (
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={4}
                      className="bg-surface-2 text-text-2 px-4 py-1.5 text-left text-xs font-bold"
                    >
                      {row.group}
                    </th>
                  </tr>
                )}
                <tr className="border-border border-b last:border-b-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal">
                    {row.label}
                  </th>
                  {COLUMNS.map(({ key, label }) => {
                    const cell = row[key];
                    // the line group makes the name unique (every line has a "Vahid qiymət")
                    const name = row.group ? `${lineCode(row.key)} ${row.label}` : row.label;
                    const state =
                      cell.state === "mismatch" || cell.state === "unknown"
                        ? STATE[cell.state]
                        : null;
                    return (
                      <td key={key} className={cn("px-4 py-2.5 tabular-nums", state?.cls)}>
                        <span className="inline-flex items-center gap-1.5">
                          {state && <state.Icon aria-hidden className="size-4 shrink-0" />}
                          {display(row, cell)}
                          {state && <span className="sr-only">{` — ${state.sr}`}</span>}
                          {cell.evidence && (
                            <button
                              type="button"
                              aria-label={`Mənbəyə bax: ${name} (${label})`}
                              title="Mənbəyə bax"
                              onClick={() => onEvidence(cell.evidence!, name)}
                              className={iconBtn}
                            >
                              <Eye aria-hidden className="size-4" />
                            </button>
                          )}
                          {onCorrect && cell.field_id && extracted.has(cell.field_id) && (
                            <button
                              type="button"
                              aria-label={`Çıxarışı düzəlt: ${name} (${label})`}
                              title="Çıxarışı düzəlt"
                              onClick={() => onCorrect(cell.field_id!)}
                              className={iconBtn}
                            >
                              <Pencil aria-hidden className="size-4" />
                            </button>
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bg-surface-2 text-text-2 m-4 flex gap-2 rounded-md p-3 text-sm">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <b>İki fərqli düzəliş yolu:</b> çıxarış səhvdirsə sahəni mənbəyə baxaraq düzəldin (sənəd
          dəyişmir, səbəb auditə yazılır). Fakturanın özündə səhv varsa, onu mənbə sistemində
          düzəldib <b>yeni versiya</b> yükləyin.
        </span>
      </p>
    </Panel>
  );
}
