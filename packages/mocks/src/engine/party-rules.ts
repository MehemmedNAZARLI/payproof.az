// R-003 same buyer on every document, R-004 same currency (sets ctx.comparable for R-005/R-006).
import { unitOf } from "./evidence";
import type { Ctx } from "./index";

export function r003({ db, o, p, add, E }: Ctx) {
  const d = p.delivery;
  const wrongDl = !!d && d.customer_id !== null && d.customer_id !== p.customer_id;
  const wrongO = !!o && o.customer_id !== p.customer_id;
  const buyer = db.customer(p.customer_id);
  if (wrongDl || wrongO) {
    const other = db.customer(wrongDl ? d!.customer_id! : o!.customer_id).name;
    add(
      "R-003",
      "FAIL",
      `${wrongDl ? "Təhvil sənədi" : "Sifariş"} başqa alıcıya — ${other} — aid ola bilər. Faktura alıcısı: ${buyer.name}.`,
      [E("invoice", "customer"), wrongDl ? E("delivery", "customer") : E("order", "customer")],
      { fix_hint: wrongDl ? "upload_delivery" : null },
    );
  } else if (d && d.customer_id === null)
    // not in the rules table: an unread buyer must never count as "same buyer" (PASS)
    add(
      "R-003",
      "UNKNOWN",
      "Təhvil sənədində alıcı oxunmadı — tərəflərin uyğunluğu təsdiqlənmir.",
      [E("delivery", "customer")],
      { fix_hint: "edit_field" },
    );
  else if (!o)
    add("R-003", "UNKNOWN", "Sifariş təsdiqlənmədən tərəflər müqayisə olunmur.", [], {
      cascade: true,
    });
  else
    add("R-003", "PASS", `Alıcı (VÖEN ${buyer.voen}) bütün sənədlərdə eynidir.`, [
      E("invoice", "customer"),
      E("order", "customer"),
      E("delivery", "customer"),
    ]);
}

export function r004(ctx: Ctx) {
  const { o, p, add, E } = ctx;
  const totals = [E("invoice", "total"), E("order", "total")];
  // lines missing from the order are R-005's finding; only shared lines are compared here
  const shared = p.invoice.lines.flatMap((l) => {
    const ol = o?.lines.find((x) => x.product_code === l.product_code);
    return ol ? [{ code: l.product_code, inv: unitOf(l), ord: unitOf(ol) }] : [];
  });
  const mismatch = shared.filter((x) => x.inv && x.ord && x.inv !== x.ord);
  const unread = shared.filter((x) => !x.inv || !x.ord);
  if (!o)
    add("R-004", "UNKNOWN", "Sifariş təsdiqlənmədən valyuta və vahid müqayisə olunmur.", [], {
      cascade: true,
    });
  else if (o.currency !== p.currency)
    add(
      "R-004",
      "UNKNOWN",
      `Faktura ${p.currency}, sifariş ${o.currency} ilə tərtib olunub. Valyuta avtomatik çevrilmir — qiymət müqayisəsi dayandırıldı.`,
      totals,
      { fix_hint: "upload_invoice" },
    );
  else if (mismatch.length)
    add(
      "R-004",
      "UNKNOWN",
      `Ölçü vahidi fərqlidir: ${mismatch.map((x) => `${x.code} (faktura: ${x.inv}, sifariş: ${x.ord})`).join("; ")}. Təsdiqlənmiş çevirmə qaydası olmadığı üçün qiymət müqayisəsi dayandırıldı.`,
      totals,
      { data: { unit_mismatch: mismatch.map((x) => x.code) } },
    );
  else if (unread.length)
    // an unread unit is never "units match": prices could be per box vs per piece
    add(
      "R-004",
      "UNKNOWN",
      `Ölçü vahidi oxunmadı: ${unread.map((x) => `${x.code} (${x.inv ? "sifariş" : "faktura"})`).join("; ")}. Vahid uyğunluğu təsdiqlənmədən qiymət müqayisəsi dayandırıldı.`,
      totals,
      { fix_hint: "edit_field", data: { unit_unread: unread.map((x) => x.code) } },
    );
  else {
    ctx.comparable = true;
    add("R-004", "PASS", `Valyuta (${p.currency}) və ölçü vahidləri uyğundur.`, totals);
  }
}
