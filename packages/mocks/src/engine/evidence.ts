// Source quotes for check evidence — port of the prototype's ev(). The serializer adds document version id + page.
import { formatMoney, formatQuantity } from "@payproof/api-client/format";
import products from "../../../../fixtures/products.json";
import { cents, decimal, sumLines } from "../money";
import type { MockDb } from "../store";
import type { EnginePkg, Order } from "../types";

export interface Ev {
  doc: "invoice" | "order" | "delivery";
  hl: string;
  quote: string;
}

const PRODUCT = Object.fromEntries(products.map((p) => [p.code, p]));
export const money = (c: number, currency?: string) => formatMoney(decimal(c), currency);
export const qty = (n: number) => formatQuantity(String(n));
const UNREAD = "oxunmur";
/** Unit as read; a line without its own unit uses the product's. */
export const unitOf = (l: { product_code: string; unit?: string | null }) =>
  l.unit === undefined ? (PRODUCT[l.product_code]?.unit ?? null) : l.unit;

function lineQuote(
  lines: { product_code: string; qty: number | null; unit_price?: string | null }[],
  code: string,
  withPrice: boolean,
) {
  const l = lines.find((x) => x.product_code === code);
  const p = PRODUCT[code];
  if (!l || !p) return "—";
  return `${p.description} — ${l.qty === null ? UNREAD : qty(l.qty)} ${p.unit}${withPrice && l.unit_price ? ` × ${formatMoney(l.unit_price)}` : ""}`;
}

/** Evidence for one highlighted field, or null when the document is not part of the package. */
export function ev(
  db: MockDb,
  p: EnginePkg,
  order: Order | null,
  doc: Ev["doc"],
  hl: string,
): Ev | null {
  const inv = p.invoice;
  const d = p.delivery;
  let quote = "";
  if (doc === "invoice") {
    const c = db.customer(p.customer_id);
    if (hl === "po")
      quote = inv.unreadable_fields.includes("po_ref")
        ? `Sifariş №: ${inv.po_raw ?? "?"} (oxunmur)`
        : `Sifariş №: ${inv.po_ref ?? "—"}`;
    else if (hl === "customer") quote = `Alıcı: ${c.name}, VÖEN ${c.voen}`;
    else if (hl === "total")
      quote = `Yekun: ${inv.total === null ? UNREAD : money(cents(inv.total), p.currency)}`;
    else if (hl.startsWith("line:")) quote = lineQuote(inv.lines, hl.slice(5), true);
  } else if (doc === "order") {
    if (!order) return null;
    if (hl === "po") quote = `Sifariş №: ${order.po_number}`;
    else if (hl === "customer") quote = `Sifarişçi: ${db.customer(order.customer_id).name}`;
    else if (hl === "total") quote = `Cəm: ${money(sumLines(order.lines), order.currency)}`;
    else if (hl.startsWith("line:")) quote = lineQuote(order.lines, hl.slice(5), true);
  } else {
    if (!d) return null;
    if (hl === "po") quote = `Əsas: sifariş ${d.po_ref ?? UNREAD}`;
    else if (hl === "customer")
      quote = `Qəbul edən: ${d.customer_id === null ? UNREAD : db.customer(d.customer_id).name}`;
    else if (hl === "signature")
      quote =
        d.signed === null
          ? `Qəbul edənin imzası: ${UNREAD}`
          : d.signed
            ? "Qəbul edənin imzası və möhürü: doldurulub"
            : "Qəbul edənin imzası: boş";
    else if (hl.startsWith("line:"))
      quote = `${lineQuote(d.lines, hl.slice(5), false)} təhvil verilib`;
  }
  return { doc, hl, quote };
}
