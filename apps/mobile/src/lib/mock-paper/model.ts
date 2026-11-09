import customers from "@fixtures/customers.json";
import expected from "@fixtures/expected.json";
import orders from "@fixtures/orders.json";
import packages from "@fixtures/packages.json";
import products from "@fixtures/products.json";

import { toCents } from "@/lib/money";

// A normalised, read-only view of one fixture package for drawing its documents as paper (mock
// mode). Money is integer cents throughout.

export type DocType = "invoice" | "order" | "delivery";
export type Line = { code: string; qty: number; price: bigint };
export type Order = {
  po: string;
  customerId: string;
  currency: string;
  date: string;
  lines: Line[];
};
export type Delivery = {
  no: string;
  poRef: string;
  customerId: string;
  date: string;
  signed: boolean;
  lines: { code: string; qty: number }[];
};
export type Rules = {
  version: number;
  requirePo: boolean;
  requireDelivery: boolean;
  requireSignature: boolean;
  tolerance: bigint;
};
export type Customer = { id: string; name: string; voen: string };

export type PackageModel = {
  fixture: FixturePackage;
  currency: string;
  customer: Customer;
  invoice: {
    number: string;
    date: string;
    poRef: string | null;
    poRaw: string | null;
    poUnreadable: boolean;
    total: bigint;
    lines: Line[];
  };
  /** The order a human (or an exact PO match) confirmed; null while the link is open. */
  order: Order | null;
  /** Orders shown on the order document: the confirmed one, else the AI candidates. */
  orderPages: Order[];
  delivery: Delivery | null;
  signatureReviewed: boolean;
  rules: Rules;
};

export type FixturePackage = (typeof packages)[number];

export const product = (code: string) => {
  const p = products.find((x) => x.code === code);
  if (!p) throw new Error(`Unknown fixture product: ${code}`);
  return p;
};

export function customer(id: string): Customer {
  const c = customers.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown fixture customer: ${id}`);
  return { id: c.id, name: c.name, voen: c.voen };
}

function order(po: string): Order {
  const o = orders.find((x) => x.po_number === po);
  if (!o) throw new Error(`Unknown fixture order: ${po}`);
  return {
    po: o.po_number,
    customerId: o.customer_id,
    currency: o.currency,
    date: o.order_date,
    lines: o.lines.map((l) => ({ code: l.product_code, qty: l.qty, price: toCents(l.unit_price) })),
  };
}

/** The rule set the golden result was computed under (the export's set once exported). */
function rules(p: FixturePackage): Rules {
  const golden = expected.packages[p.invoice_number as keyof typeof expected.packages];
  const sets = customers.find((c) => c.id === p.customer_id)?.requirement_sets ?? [];
  const r = sets.find((s) => s.version === golden.requirement_set_version);
  if (!r) throw new Error(`No requirement set for ${p.id}`);
  return {
    version: r.version,
    requirePo: r.require_po,
    requireDelivery: r.require_delivery,
    requireSignature: r.require_signature,
    tolerance: toCents(r.tolerance),
  };
}

export function packageModel(p: FixturePackage): PackageModel {
  const link = p.order_link;
  const confirmed = link.confirmed && link.po_number ? order(link.po_number) : null;
  const d = p.delivery;
  return {
    fixture: p,
    currency: p.currency,
    customer: customer(p.customer_id),
    invoice: {
      number: p.invoice_number,
      date: p.invoice_date,
      poRef: p.invoice.po_ref,
      poRaw: p.invoice.po_raw,
      poUnreadable: (p.invoice.unreadable_fields as readonly string[]).includes("po_ref"),
      total: toCents(p.invoice.total),
      lines: p.invoice.lines.map((l) => ({
        code: l.product_code,
        qty: l.qty,
        price: toCents(l.unit_price),
      })),
    },
    order: confirmed,
    orderPages: confirmed ? [confirmed] : p.candidates.map((c) => order(c.po_number)),
    delivery: d && {
      no: d.note_number,
      poRef: d.po_ref,
      customerId: d.customer_id,
      date: d.delivery_date,
      signed: d.signed,
      lines: d.lines.map((l) => ({ code: l.product_code, qty: l.qty })),
    },
    signatureReviewed: p.signature_reviewed,
    rules: rules(p),
  };
}
