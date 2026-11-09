// Field-by-field comparison table — port of the prototype's comparePanel(). Values stay contract strings.
import type { Schemas } from "@payproof/api-client";
import products from "../../../../fixtures/products.json";
import { ev } from "../engine/evidence";
import { decimal, sumLines } from "../money";
import type { MockDb } from "../store";
import type { Pkg } from "../types";
import { evidence, fieldPaths } from "./documents";
import { id } from "../ids";

type Cell = Schemas["ComparisonCell"];
type State = Cell["state"];
const PRODUCT = Object.fromEntries(products.map((p) => [p.code, p]));

export function comparison(db: MockDb, p: Pkg): Schemas["ComparisonRow"][] {
  const o =
    p.order_link.confirmed && p.order_link.po_number
      ? (db.orders[p.order_link.po_number] ?? null)
      : null;
  const d = p.delivery;
  const cur = p.currency;
  const sameCur = !!o && o.currency === cur;
  const dlLinked = !!d && !!o && d.po_ref === o.po_number;
  const paths = fieldPaths(p);
  const fieldId = (path: string) => id.field(p.id, "invoice", paths.indexOf(path) + 1);
  const src = (doc: "invoice" | "order" | "delivery", hl: string) => {
    const e = ev(db, p, o, doc, hl);
    return e && evidence(p, e);
  };
  const cell = (value: string | null, bad: State | null = null, x: Partial<Cell> = {}): Cell => ({
    value,
    currency: null,
    state: value === null && bad !== "unknown" && bad !== "mismatch" ? "empty" : (bad ?? "ok"),
    field_id: null,
    evidence: null,
    ...x,
  });
  const rows: Schemas["ComparisonRow"][] = [];
  const add = (
    key: string,
    label: string,
    invoice: Cell,
    order: Cell,
    delivery: Cell,
    group: string | null = null,
  ) => rows.push({ key, group, label, invoice, order, delivery });

  const unread = p.invoice.unreadable_fields.includes("po_ref");
  const po = p.invoice.po_ref;
  add(
    "po_ref",
    "Sifariş № (PO)",
    cell(
      unread ? null : po,
      unread ? "unknown" : !po || (o && po !== o.po_number) ? "mismatch" : null,
      { field_id: fieldId("invoice.po_ref"), evidence: src("invoice", "po") },
    ),
    cell(o?.po_number ?? null),
    cell(d?.po_ref ?? null, d && o && d.po_ref !== o.po_number ? "unknown" : null, {
      evidence: src("delivery", "po"),
    }),
  );
  const name = (c: string) => db.customer(c).name;
  add(
    "customer",
    "Alıcı",
    cell(name(p.customer_id), null, { evidence: src("invoice", "customer") }),
    cell(o ? name(o.customer_id) : null, o && o.customer_id !== p.customer_id ? "mismatch" : null),
    cell(d ? name(d.customer_id) : null, d && d.customer_id !== p.customer_id ? "mismatch" : null, {
      evidence: src("delivery", "customer"),
    }),
  );
  add(
    "currency",
    "Valyuta",
    cell(cur),
    cell(o?.currency ?? null, o && !sameCur ? "unknown" : null),
    cell(null),
  );

  for (const l of p.invoice.lines) {
    const code = l.product_code;
    const ol = o?.lines.find((x) => x.product_code === code);
    const dl = dlLinked ? d!.lines.find((x) => x.product_code === code) : undefined;
    const group = `${code} · ${PRODUCT[code]?.description ?? code}`;
    const qtyBad = (sameCur && ol && ol.qty !== l.qty) || (dl && dl.qty !== l.qty);
    add(
      `lines[${code}].qty`,
      `Miqdar (${PRODUCT[code]?.unit ?? ""})`,
      cell(String(l.qty), qtyBad ? "mismatch" : null, {
        field_id: fieldId(`invoice.lines[${code}].qty`),
        evidence: src("invoice", `line:${code}`),
      }),
      cell(ol ? String(ol.qty) : null),
      cell(
        dl ? String(dl.qty) : null,
        dl && dl.qty !== l.qty ? "mismatch" : null,
        dl ? { evidence: src("delivery", `line:${code}`) } : {},
      ),
      group,
    );
    add(
      `lines[${code}].unit_price`,
      "Vahid qiymət",
      cell(l.unit_price, sameCur && ol && ol.unit_price !== l.unit_price ? "mismatch" : null, {
        currency: cur,
        field_id: fieldId(`invoice.lines[${code}].unit_price`),
        evidence: src("invoice", `line:${code}`),
      }),
      cell(
        ol?.unit_price ?? null,
        o && !sameCur ? "unknown" : null,
        ol ? { currency: o!.currency } : {},
      ),
      cell(null),
      group,
    );
  }
  add(
    "total",
    "Yekun məbləğ",
    cell(p.invoice.total, null, { currency: cur, evidence: src("invoice", "total") }),
    cell(
      o ? decimal(sumLines(o.lines)) : null,
      o && !sameCur ? "unknown" : null,
      o ? { currency: o.currency } : {},
    ),
    cell(null),
    "Cəmlər",
  );
  return rows;
}
