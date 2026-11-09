// Order link confirmation, signature review and manual extraction correction (with reason, audited).
import { formatMoney } from "@payproof/api-client/format";
import { cents, decimal } from "../money";
import type { MockDb } from "../store";
import type { Pkg } from "../types";
import { log, MockError } from "./audit";
import { bump, validate } from "./validate";

export function confirmLink(db: MockDb, p: Pkg, po: string, actor: string): boolean {
  if (p.order_link.confirmed && p.order_link.po_number === po) return false;
  p.order_link = { po_number: po, confirmed: true, confirmed_by: actor, method: "human" };
  p.candidates = [];
  bump(db, p, "sifariş əlaqəsi dəyişdi");
  log(db, {
    actor,
    action: "link.confirmed",
    message: `${po} · üsul: insan təsdiqi · paket v${p.version}`,
    pkg: p.id,
    objectType: "order_link",
  });
  validate(db, p);
  return true;
}

export function reviewSignature(db: MockDb, p: Pkg, actor: string): boolean {
  if (p.signature_reviewed || !p.delivery) return false;
  p.signature_reviewed = true;
  log(db, {
    actor,
    action: "signature.reviewed",
    message: `${p.delivery.note_number}: imzanın vizual mövcudluğu təsdiqləndi (hüquqi autentifikasiya deyil)`,
    pkg: p.id,
  });
  validate(db, p);
  return true;
}

const LINE_FIELD = /^invoice\.lines\[([^\]]+)\]\.(qty|unit_price)$/;

export function correctField(
  db: MockDb,
  p: Pkg,
  path: string,
  value: string,
  reason: string,
  actor: string,
) {
  const bad = (m: string) => new MockError("VALIDATION_ERROR", m, 422, { fields: { value: m } });
  let from: string;
  if (path === "invoice.po_ref") {
    if (!/^PO-\d+$/.test(value)) throw bad("Sifariş nömrəsi PO-123 formatında olmalıdır.");
    from = p.invoice.unreadable_fields.includes("po_ref")
      ? `${p.invoice.po_raw ?? "?"} (oxunmur)`
      : (p.invoice.po_ref ?? "—");
    p.invoice.po_ref = value;
    p.invoice.unreadable_fields = p.invoice.unreadable_fields.filter((f) => f !== "po_ref");
    p.invoice.po_raw = null;
    const inv = p.documents.find((d) => d.type === "invoice")!.versions.at(-1)!;
    inv.status = "EXTRACTED";
  } else {
    const m = LINE_FIELD.exec(path);
    const line = m && p.invoice.lines.find((l) => l.product_code === m[1]);
    if (!m || !line) throw new MockError("NOT_FOUND", "Sahə tapılmadı.", 404);
    if (m[2] === "qty") {
      if (!/^[1-9]\d*$/.test(value)) throw bad("Miqdar müsbət tam ədəd olmalıdır.");
      from = String(line.qty);
      line.qty = Number(value);
    } else {
      if (!/^\d+\.\d{2}$/.test(value)) throw bad("Vahid qiymət 100.00 formatında olmalıdır.");
      from = formatMoney(line.unit_price);
      line.unit_price = decimal(cents(value));
    }
  }
  (p.corrections ??= {})[path] = { from, to: value, reason, by: actor };
  bump(db, p, "kritik sahə əl ilə düzəldildi");
  log(db, {
    actor,
    action: "field.corrected",
    message: `${path}: “${from}” → “${value}” · səbəb: ${reason} · sənədin özü dəyişmədi`,
    pkg: p.id,
    objectType: "extracted_field",
  });
  validate(db, p);
}
