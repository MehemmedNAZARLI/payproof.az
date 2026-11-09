import { formatMoney } from "@/lib/format";
import { decimal } from "@/lib/money";

import {
  customer,
  type Delivery,
  type Line,
  type Order,
  type PackageModel,
  product,
} from "./model";

// Evidence quotes, as the prototype's ev() writes them. The paper renderer calls the same
// functions for each region it draws, so a quote identifies the region to highlight.

export type Anchor = "po" | "customer" | "total" | "signature" | `line:${string}`;

export const money = (cents: bigint, currency?: string) => formatMoney(decimal(cents), currency);
export const quantity = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const lineSum = (lines: Line[]) => lines.reduce((s, l) => s + l.price * BigInt(l.qty), 0n);

function lineQuote(lines: { code: string; qty: number; price?: bigint }[], code: string) {
  const l = lines.find((x) => x.code === code);
  if (!l) return "—";
  const p = product(code);
  return `${p.description} — ${quantity(l.qty)} ${p.unit}${l.price === undefined ? "" : ` × ${money(l.price)}`}`;
}

const lineCode = (anchor: Anchor) => (anchor.startsWith("line:") ? anchor.slice(5) : null);

export function invoiceQuote(m: PackageModel, anchor: Anchor): string | null {
  const inv = m.invoice;
  if (anchor === "po")
    return inv.poUnreadable
      ? `Sifariş №: ${inv.poRaw ?? "?"} (oxunmur)`
      : `Sifariş №: ${inv.poRef ?? "—"}`;
  if (anchor === "customer") return `Alıcı: ${m.customer.name}, VÖEN ${m.customer.voen}`;
  if (anchor === "total") return `Yekun: ${money(inv.total, m.currency)}`;
  const code = lineCode(anchor);
  return code ? lineQuote(inv.lines, code) : null;
}

export function orderQuote(o: Order, anchor: Anchor): string | null {
  if (anchor === "po") return `Sifariş №: ${o.po}`;
  if (anchor === "customer") return `Sifarişçi: ${customer(o.customerId).name}`;
  if (anchor === "total") return `Cəm: ${money(lineSum(o.lines), o.currency)}`;
  const code = lineCode(anchor);
  return code ? lineQuote(o.lines, code) : null;
}

export function deliveryQuote(d: Delivery, anchor: Anchor): string | null {
  if (anchor === "po") return `Əsas: sifariş ${d.poRef}`;
  if (anchor === "customer") return `Qəbul edən: ${customer(d.customerId).name}`;
  if (anchor === "signature")
    return d.signed ? "Qəbul edənin imzası və möhürü: doldurulub" : "Qəbul edənin imzası: boş";
  const code = lineCode(anchor);
  return code ? `${lineQuote(d.lines, code)} təhvil verilib` : null;
}
