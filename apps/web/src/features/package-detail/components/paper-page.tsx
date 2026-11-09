import type { Schemas } from "@payproof/api-client";
import { documentTypeLabel } from "@payproof/api-client/i18n";
import { cn } from "@/lib/utils";
import { detailText as t } from "../texts";

type Pkg = Schemas["PackageDetail"];

/**
 * Mock mode has no real files: show the page as the text the system extracted from it — every
 * evidence quote of this version and page — with the cited one marked. No invented layout or
 * coordinates (prototype `.paper`).
 */
export function PaperPage({
  pkg,
  version,
  docType,
  evidence,
}: {
  pkg: Pkg;
  version: Schemas["DocumentVersion"];
  docType: Schemas["DocumentType"];
  evidence: Schemas["Evidence"];
}) {
  const quotes = [
    ...new Set(
      pkg.fields
        .map((f) => f.evidence)
        .filter((e) => e?.document_version_id === version.id && e.page === evidence.page)
        .map((e) => e!.quote),
    ),
  ];
  if (!quotes.includes(evidence.quote)) quotes.unshift(evidence.quote);
  return (
    <div
      className={cn(
        "bg-paper text-paper-ink border-paper-line rounded-sm border p-7 text-[12.5px] leading-relaxed shadow-2",
        version.source_kind === "scan" && "bg-paper-scan -rotate-[0.4deg]",
      )}
    >
      <div className="border-paper-ink mb-3 flex justify-between gap-4 border-b-2 pb-2.5">
        <span>
          {`${t.buyer}: `}
          <b>{pkg.customer.name}</b>
        </span>
        <div className="text-right text-[11px] font-extrabold tracking-wider uppercase">
          {documentTypeLabel[docType]}
          <b className="block text-[15px] tracking-normal normal-case">{version.file_name}</b>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {quotes.map((q) =>
          q === evidence.quote ? (
            <li key={q}>
              <mark className="bg-paper-hl ring-paper-hl-ring rounded-sm px-1 text-inherit ring-2">
                {q}
              </mark>
            </li>
          ) : (
            <li key={q}>{q}</li>
          ),
        )}
      </ul>
      <div className="border-paper-line text-paper-muted mt-3.5 flex justify-between border-t border-dashed pt-2 text-[10.5px]">
        <span>{`Səhifə ${evidence.page}`}</span>
        <span>{`${version.file_name} · v${version.version_no}`}</span>
      </div>
    </div>
  );
}
