// R-005 unit price and R-006 quantity — only when R-004 made invoice and order comparable.
import { cents, decimal } from "../money";
import { money, qty, unitOf } from "./evidence";
import type { Ctx } from "./index";

const line = (code: string) => `line:${code}`;

/** Line rules on an invoice whose lines were not read: UNKNOWN, never a vacuous PASS. */
export function noLines({ p, add }: Ctx, rule: string) {
  if (p.invoice.lines.length) return false;
  add(rule, "UNKNOWN", "Faktura sətirləri oxunmadı. Mənbəyə baxıb sahəni təsdiqləyin.", [], {
    fix_hint: "edit_field",
  });
  return true;
}

export function r005(ctx: Ctx) {
  const { o, p, comparable, add, E } = ctx;
  const cur = p.currency;
  if (!comparable || !o) {
    add(
      "R-005",
      "UNKNOWN",
      "Valyuta və vahid uyğunluğu təsdiqlənmədən qiymət müqayisə edilmir.",
      [],
      {
        cascade: true,
      },
    );
    return;
  }
  if (noLines(ctx, "R-005")) return;
  const lines = p.invoice.lines;
  const missing = lines.filter((l) => !o.lines.some((x) => x.product_code === l.product_code));
  const unread = lines.filter((l) => l.unit_price === null || l.qty === null);
  const diffs: { code: string; inv: number; ord: number; qty: number; diff: number }[] = [];
  for (const l of lines) {
    const ol = o.lines.find((x) => x.product_code === l.product_code);
    if (ol && l.unit_price !== null && l.qty !== null && ol.unit_price !== l.unit_price) {
      const inv = cents(l.unit_price);
      const ord = cents(ol.unit_price);
      diffs.push({ code: l.product_code, inv, ord, qty: l.qty, diff: (inv - ord) * l.qty });
    }
  }
  if (missing.length)
    add(
      "R-005",
      "UNKNOWN",
      `Sifarişdə olmayan sətir: ${missing.map((l) => l.product_code).join(", ")}. Avtomatik uyğun sayılmır.`,
      missing.map((l) => E("invoice", line(l.product_code))),
    );
  else if (unread.length)
    // not in the rules table: a difference cannot be computed, so this is never PASS
    add(
      "R-005",
      "UNKNOWN",
      `Vahid qiymət və ya miqdar oxunmadı: ${unread.map((l) => l.product_code).join(", ")}. Mənbəyə baxıb sahəni təsdiqləyin.`,
      unread.map((l) => E("invoice", line(l.product_code))),
      { fix_hint: "edit_field" },
    );
  else if (diffs.length) {
    const total = diffs.reduce((a, x) => a + x.diff, 0);
    add(
      "R-005",
      "FAIL",
      diffs
        .map(
          (x) =>
            `${x.code}: fakturada ${money(x.inv, cur)}, sifarişdə ${money(x.ord, cur)} × ${qty(x.qty)} = ${money(x.diff, cur)} fərq`,
        )
        .join("; ") + ". Aktual qiymət əlavəsini yoxlayın. Fərq itki və ya gəlir sayılmır.",
      diffs.flatMap((x) => [E("invoice", line(x.code)), E("order", line(x.code))]),
      {
        fix_hint: "upload_invoice",
        data: { line_difference: { amount: decimal(total), currency: cur } },
      },
    );
  } else {
    const first = p.invoice.lines[0]!.product_code;
    add("R-005", "PASS", `${p.invoice.lines.length} sətirdə vahid qiymət sifarişlə eynidir.`, [
      E("invoice", line(first)),
      E("order", line(first)),
    ]);
  }
}

export function r006(ctx: Ctx) {
  const { o, p, comparable, add, E } = ctx;
  if (!comparable || !o) {
    add(
      "R-006",
      "UNKNOWN",
      "Miqdar müqayisəsi sifariş və vahid uyğunluğu təsdiqləndikdən sonra aparılır.",
      [],
      {
        cascade: true,
      },
    );
    return;
  }
  if (noLines(ctx, "R-006")) return;
  const d = p.delivery;
  const dlOk = !!d && d.po_ref === o.po_number && d.customer_id === p.customer_id;
  const lines = p.invoice.lines;
  // [code, document] of every quantity that was not read
  const unread: [string, "invoice" | "delivery"][] = lines
    .filter((l) => l.qty === null)
    .map((l) => [l.product_code, "invoice"]);
  if (dlOk)
    for (const l of lines)
      if (d.lines.find((x) => x.product_code === l.product_code)?.qty === null)
        unread.push([l.product_code, "delivery"]);
  if (unread.length) {
    // not in the rules table: an unread quantity is never "quantities match"
    add(
      "R-006",
      "UNKNOWN",
      `Miqdar oxunmadı: ${[...new Set(unread.map(([c]) => c))].join(", ")}. Mənbəyə baxıb sahəni təsdiqləyin.`,
      unread.map(([c, doc]) => E(doc, line(c))),
      { fix_hint: "edit_field" },
    );
    return;
  }
  const probs: string[] = [];
  const evs = [];
  for (const l of lines) {
    const code = l.product_code;
    const n = l.qty ?? 0;
    const ol = o.lines.find((x) => x.product_code === code);
    const u = unitOf(l) || (ol ? unitOf(ol) : null);
    const unit = u ? ` ${u}` : "";
    if (ol && ol.qty !== n) {
      probs.push(`${code}: fakturada ${qty(n)}, sifarişdə ${qty(ol.qty)}${unit}`);
      evs.push(E("invoice", line(code)), E("order", line(code)));
    }
    if (dlOk) {
      const dq = d.lines.find((x) => x.product_code === code)?.qty ?? 0;
      if (dq !== n) {
        probs.push(`${code}: fakturada ${qty(n)}, təhvil aktında ${qty(dq)}${unit}`);
        evs.push(E("invoice", line(code)), E("delivery", line(code)));
      }
    }
  }
  const first = lines[0]!.product_code;
  if (probs.length)
    add(
      "R-006",
      "FAIL",
      `${probs.join("; ")}. Qismən çatdırılma P0-da avtomatik uyğun sayılmır.`,
      evs,
      {
        fix_hint: "upload_invoice",
      },
    );
  else
    add(
      "R-006",
      "PASS",
      dlOk
        ? "Sifariş, faktura və təhvil miqdarları uyğundur."
        : "Faktura və sifariş miqdarları uyğundur; uyğun təhvil sənədi olmadığı üçün təhvil miqdarı müqayisə edilmədi.",
      [E("invoice", line(first)), dlOk ? E("delivery", line(first)) : null],
    );
}
