import type { Schemas } from "@payproof/api-client";
import { formatDateTime } from "@payproof/api-client/format";
import { documentTypeLabel } from "@payproof/api-client/i18n";
import {
  ChevronRight,
  Info,
  Eye,
  FileText,
  Link2,
  ShoppingCart,
  Truck,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { DocumentStatusBadge, StatusBadge } from "@/components/status/status-badges";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import { detailText as t } from "../texts";
import { Inert } from "./package-actions";

type Pkg = Schemas["PackageDetail"];
type DocType = Schemas["DocumentType"];
/** Absent: the role may not upload (the server checks it again). */
type OnUpload = ((type: "invoice" | "delivery") => void) | undefined;

const UploadButton = ({ label, onClick }: { label: string; onClick?: () => void }) =>
  onClick ? (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Upload aria-hidden />
      {label}
    </Button>
  ) : (
    <Inert size="sm" icon={Upload} label={label} reason={t.noEdit} />
  );

const TYPES: DocType[] = ["invoice", "order", "delivery"];
const ICON: Record<DocType, LucideIcon> = {
  invoice: FileText,
  order: ShoppingCart,
  delivery: Truck,
};
// shortcut: source labels here until shared i18n has them
const SOURCE: Record<Schemas["DocumentVersion"]["source_kind"], string> = {
  pdf: "PDF",
  scan: "Skan",
  spreadsheet: "Cədvəl",
};
const provenance = (v: Schemas["DocumentVersion"]) =>
  `${v.uploaded_by.full_name} · ${formatDateTime(v.uploaded_at)}`;
const Tag = ({ children }: { children: ReactNode }) => (
  <span className="bg-surface-2 text-text-2 border-border rounded-sm border px-1.5 py-px text-[11px] font-bold">
    {children}
  </span>
);

function Missing({ type, pkg, onUpload }: { type: DocType; pkg: Pkg; onUpload: OnUpload }) {
  // R-007 is the only document rule; "no document" must never read as "document unreadable"
  const required = type === "delivery" && pkg.requirement_set.require_delivery;
  const Icon = ICON[type];
  const label = documentTypeLabel[type];
  return (
    <article
      aria-label={label}
      className={cn(
        "rounded-md border-[1.5px] border-dashed p-3",
        required ? "border-danger/55 bg-danger-bg" : "border-border bg-surface-2",
      )}
    >
      <div className="flex gap-2">
        <Icon aria-hidden className="text-brand mt-px size-5 shrink-0" />
        <div>
          <div className="text-sm font-semibold">{`${label} yoxdur`}</div>
          <div className="text-text-3 text-xs">
            {required
              ? `Müştəri qaydası (v${pkg.requirement_set.version}) bu sənədi tələb edir. “Sənəd yoxdur” — “sənəd oxunmadı” deyil.`
              : "Bu müştəri üçün tələb olunmur."}
          </div>
        </div>
      </div>
      {required && (
        <div className="mt-2">
          <UploadButton label="Yüklə" onClick={onUpload && (() => onUpload("delivery"))} />
        </div>
      )}
    </article>
  );
}

function DocumentCard({
  doc,
  pkg,
  onUpload,
}: {
  doc: Schemas["Document"];
  pkg: Pkg;
  onUpload: OnUpload;
}) {
  const v = doc.current;
  const Icon = ICON[doc.type];
  const label = documentTypeLabel[doc.type];
  const awaitingLink = doc.type === "order" && !pkg.link.confirmed;
  return (
    <article aria-label={label} className="border-border bg-surface rounded-md border p-3">
      <div className="flex gap-2">
        <Icon aria-hidden className="text-brand mt-px size-5 shrink-0" />
        <div className="min-w-0 grow">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{label}</span>
            <Tag>{`v${v.version_no}`}</Tag>
          </div>
          <div className="text-sm font-semibold break-all">{v.file_name}</div>
          <div className="my-1 flex flex-wrap items-center gap-1.5">
            {awaitingLink ? (
              <StatusBadge tone="warning" icon={Link2} label="Uyğunlaşdırma gözləyir" />
            ) : (
              <DocumentStatusBadge status={v.status} />
            )}
            <Tag>{SOURCE[v.source_kind]}</Tag>
          </div>
          <div className="text-text-3 text-xs">{`${provenance(v)} · hash ${v.sha256.slice(0, 8)}`}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Inert size="sm" icon={Eye} label="Bax" reason={t.soon} />
        {doc.type !== "order" && (
          <UploadButton
            label="Yeni versiya"
            onClick={onUpload && (() => onUpload(doc.type as "invoice" | "delivery"))}
          />
        )}
      </div>
      {doc.history.length > 0 && (
        <details className="group mt-1.5">
          <summary className="text-text-2 flex cursor-pointer list-none items-center gap-1 py-1 text-xs font-semibold">
            <ChevronRight
              aria-hidden
              className="size-3.5 transition-transform group-open:rotate-90"
            />
            {`Əvvəlki versiyalar (${doc.history.length}) — audit üçün saxlanılır`}
          </summary>
          <ul>
            {doc.history.map((old) => (
              <li
                key={old.id}
                className="border-border text-text-2 border-t border-dashed py-1.5 text-xs"
              >
                {`v${old.version_no} · ${old.file_name}`}
                <div className="text-text-3">{provenance(old)}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

/** Documents and their versions (prototype `docsPanel`). */
export function DocumentsPanel({ pkg, onUpload }: { pkg: Pkg; onUpload?: OnUpload }) {
  return (
    <Panel title={t.documents} className="flex flex-col gap-3 [grid-area:docs]">
      {TYPES.map((type) => {
        const doc = pkg.documents.find((d) => d.type === type);
        return doc ? (
          <DocumentCard key={type} doc={doc} pkg={pkg} onUpload={onUpload} />
        ) : (
          <Missing key={type} type={type} pkg={pkg} onUpload={onUpload} />
        );
      })}
      {/* AI does extraction only; a prepared mock result must never pass for live AI analysis */}
      {process.env.NEXT_PUBLIC_API_MOCK === "1" && (
        <p className="text-text-3 flex gap-1.5 text-xs">
          <Info aria-hidden className="size-4 shrink-0" />
          {t.mockExtraction}
        </p>
      )}
    </Panel>
  );
}
