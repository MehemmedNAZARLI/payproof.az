// Document upload: duplicate check by sha256, pre-processed sample extraction (AI_PROVIDER=mock), new version.
import { documentTypeLabel } from "@payproof/api-client/i18n";
import { id, type DocType } from "../ids";
import { decimal, sumLines } from "../money";
import type { MockDb } from "../store";
import type { DocVersion, Pkg } from "../types";
import { log, MockError } from "./audit";
import { bump, validate } from "./validate";

/** Synthetic sha256 over the file name — same convention as fixtures (demo files have no bytes). */
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const sourceKind = (f: string): DocVersion["source_kind"] =>
  /\.(jpe?g|png)$/i.test(f) ? "scan" : /\.(xlsx|csv)$/i.test(f) ? "spreadsheet" : "pdf";

// shortcut: a file that matches no fixtures/samples.json entry is stored as a version without changing
// extracted data — upgrade when real extraction (B-15) lands.
export async function uploadDocument(
  db: MockDb,
  p: Pkg,
  type: DocType,
  fileName: string,
  actor: string,
) {
  const hash = await sha256(fileName);
  for (const d of p.documents)
    for (const v of d.versions)
      if (v.sha256 === hash) {
        log(db, {
          actor,
          action: "document.duplicate",
          message: `${fileName}: ${documentTypeLabel[d.type]} v${v.version_no} ilə eyni hash — yeni versiya yaradılmadı`,
          pkg: p.id,
          objectType: "document_version",
        });
        throw new MockError(
          "DUPLICATE_FILE",
          `${fileName}: ${documentTypeLabel[d.type]} v${v.version_no} ilə eyni fayldır — yeni versiya yaradılmadı.`,
          409,
          { document_version_id: id.version(p.id, d.type, v.version_no), version_no: v.version_no },
        );
      }
  const x = db.samples.find((s) => s.file_name === fileName && s.type === type)?.extraction;
  if (type === "invoice" && x) {
    if (x.po_ref !== undefined) p.invoice.po_ref = x.po_ref;
    if (x.currency) p.currency = x.currency;
    const l = x.line && p.invoice.lines.find((y) => y.product_code === x.line!.product_code);
    if (l && x.line?.unit_price) l.unit_price = x.line.unit_price;
    if (l && x.line?.qty != null) l.qty = x.line.qty;
    p.invoice.total = decimal(sumLines(p.invoice.lines));
    p.invoice.unreadable_fields = [];
    p.invoice.po_raw = null;
  } else if (type === "delivery" && x?.delivery) {
    p.delivery = {
      note_number: x.delivery.note_number,
      po_ref: x.delivery.po_ref,
      customer_id: p.customer_id,
      delivery_date: db.nowIso().slice(0, 10),
      signed: x.delivery.signed,
      lines: p.invoice.lines.map((l) => ({ product_code: l.product_code, qty: l.qty })),
    };
    p.signature_reviewed = false;
  }
  let doc = p.documents.find((d) => d.type === type);
  if (!doc) p.documents.push((doc = { type, versions: [] }));
  bump(db, p, `${documentTypeLabel[type].toLowerCase()} yeni versiyası yükləndi`);
  const version: DocVersion = {
    version_no: doc.versions.length + 1,
    file_name: fileName,
    sha256: hash,
    source_kind: sourceKind(fileName),
    uploaded_by: actor,
    uploaded_at: db.tick(),
    status: "EXTRACTED",
    package_version_at_upload: p.version,
    ...(type === "delivery" && p.delivery ? { signed: p.delivery.signed } : {}),
  };
  doc.versions.push(version);
  log(db, {
    actor,
    action: "document.uploaded",
    message: `${documentTypeLabel[type]}: ${fileName} (sənəd v${version.version_no}) · paket v${p.version}`,
    pkg: p.id,
    objectType: "document_version",
    objectId: id.version(p.id, type, version.version_no),
  });
  log(db, {
    actor: "system",
    action: "document.extracted",
    message: `${fileName}: sahələr və mənbə istinadları çıxarıldı (əvvəlcədən hazırlanmış nəticə)`,
    pkg: p.id,
    objectType: "document_version",
  });
  validate(db, p);
  return { type, version_no: version.version_no };
}
