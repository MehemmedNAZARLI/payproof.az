import { Badge } from "@/components/ui/badge";
import { Card, SectionHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { Schemas } from "@/lib/api";

type Detail = Schemas["PackageDetail"];
export function AiSummary({ pkg }: { pkg: Detail }) {
  if (pkg.processing) return null;
  const documents = pkg.documents.filter((d) => ["EXTRACTED", "REVIEW_REQUIRED"].includes(d.current.status)).length;
  const extracted = pkg.fields.filter((f) => f.review_status === "EXTRACTED" && f.value !== null).length;
  return (
    <Card className="mt-4 p-5">
      <div className="text-accent flex items-center gap-2 text-footnote font-semibold">
        <Icon name="shield" size={18} /> AI document review
      </div>
      <p className="mt-3 text-body font-medium">
        AI read {documents} documents and extracted {extracted} fields.
      </p>
      <p className="text-text-2 mt-2 text-footnote">
        {pkg.summary.pass} checks passed, {pkg.summary.fail + pkg.summary.unknown} need attention.
        {" "}Source-backed results link to their page and quote below.
      </p>
      <p className="text-text-3 mt-2 text-caption">Unreadable means unknown. A human approves before the form is filled and sent.</p>
    </Card>
  );
}

function fieldLabel(path: string) {
  if (path === "invoice.po_ref") return "Purchase order number";
  const code = path.match(/\[([^\]]+)\]/)?.[1];
  if (path.endsWith(".qty")) return `${code ?? "Line"} · quantity`;
  if (path.endsWith(".unit_price")) return `${code ?? "Line"} · unit price`;
  return path.replaceAll("_", " ");
}

export function ExtractedFields({ pkg, onSource }: {
  pkg: Detail; onSource: (source: Schemas["Evidence"]) => void;
}) {
  if (pkg.processing || pkg.fields.length === 0) return null;
  return (
    <section aria-label="Extracted fields">
      <SectionHeader title="Extracted fields" />
      <Card className="divide-separator divide-y p-0">
        {pkg.fields.map((field) => {
          const unknown = field.review_status === "REVIEW_REQUIRED" || field.value === null;
          return (
            <div key={field.id} className="px-4 py-3">
              <p className="text-text-3 text-caption">{fieldLabel(field.field_path)}</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-callout font-semibold tabular-nums">
                  {unknown ? "Unknown" : field.value}
                  {!unknown && field.field_path.endsWith(".unit_price") && pkg.total ? ` ${pkg.total.currency}` : ""}
                </span>
                <Badge tone={unknown ? "warning" : "accent"}>
                  {unknown ? "Needs review" : field.review_status === "CORRECTED" ? "Human corrected" : "AI"}
                </Badge>
              </div>
              {field.evidence ? (
                <button type="button" onClick={() => onSource(field.evidence!)} className="text-accent flex min-h-11 items-center gap-1 text-caption font-medium">
                  <Icon name="link" size={14} /> View source · p. {field.evidence.page}
                </button>
              ) : <p className="text-text-3 mt-2 text-caption">No source available</p>}
            </div>
          );
        })}
      </Card>
    </section>
  );
}
