// R-007 delivery note present and linked, R-008 signature (human review), R-009 invoice arithmetic.
import { cents, sumLines } from "../money";
import type { PricedLine } from "../types";
import { money } from "./evidence";
import type { Ctx } from "./index";
import { noLines } from "./line-rules";

export function r007({ r, o, p, add, E }: Ctx) {
  const d = p.delivery;
  const note = d?.note_number || "Təhvil";
  if (!r.require_delivery)
    add("R-007", "NOT_APPLICABLE", "Müştəri qaydası təhvil sənədi tələb etmir.");
  else if (!d)
    add(
      "R-007",
      "FAIL",
      `Müştəri qaydası ${r.require_signature ? "imzalanmış " : ""}təhvil sənədi tələb edir; paketdə təhvil sənədi yoxdur.`,
      [],
      { fix_hint: "upload_delivery" },
    );
  else if (!o)
    add("R-007", "UNKNOWN", "Sifariş təsdiqlənmədən təhvil sənədinin bağlılığı yoxlanmır.", [], {
      cascade: true,
    });
  else if (d.po_ref === null)
    // not in the rules table: an unread PO on the note is never "linked"
    add(
      "R-007",
      "UNKNOWN",
      `${note} sənədində sifariş nömrəsi oxunmadı. Uyğunluq təsdiqlənməyib.`,
      [E("delivery", "po")],
      { fix_hint: "edit_field" },
    );
  else if (d.po_ref !== o.po_number)
    add(
      "R-007",
      "UNKNOWN",
      `${note} sənədində sifariş: ${d.po_ref}; təsdiqlənmiş sifariş: ${o.po_number}. Uyğunluq təsdiqlənməyib.`,
      [E("delivery", "po"), E("order", "po")],
      { fix_hint: "upload_delivery" },
    );
  else
    add("R-007", "PASS", `${note} paketdədir və ${o.po_number} sifarişinə bağlıdır.`, [
      E("delivery", "po"),
    ]);
}

export function r008({ r, p, out, add, E }: Ctx) {
  const d = p.delivery;
  const r007 = out.find((c) => c.rule_id === "R-007")?.outcome;
  if (!r.require_signature) add("R-008", "NOT_APPLICABLE", "Müştəri qaydası imza tələb etmir.");
  else if (!d)
    add("R-008", "NOT_APPLICABLE", "Təhvil sənədi olmadan imza yoxlanmır — R-007-yə baxın.");
  else if (r007 !== "PASS")
    add("R-008", "UNKNOWN", "Təhvil sənədinin uyğunluğu təsdiqlənmədən imza yoxlanmır.", [], {
      cascade: true,
    });
  else if (d.signed === false)
    // null = not read: a person decides, like a present signature
    add(
      "R-008",
      "FAIL",
      "Təhvil aktında qəbul edənin imza sahəsi boşdur.",
      [E("delivery", "signature")],
      {
        fix_hint: "upload_delivery",
      },
    );
  else if (!p.signature_reviewed)
    add(
      "R-008",
      "UNKNOWN",
      "İmza tələb olunur: əməkdaş sənədə baxıb imzanın mövcudluğunu təsdiqləməlidir.",
      [E("delivery", "signature")],
      { fix_hint: "review_signature" },
    );
  else
    add(
      "R-008",
      "PASS",
      "Əməkdaş imzanın vizual mövcudluğunu təsdiqləyib. Bu, imzanın hüquqi autentifikasiyası deyil.",
      [E("delivery", "signature")],
    );
}

export function r009(ctx: Ctx) {
  const { r, p, add, E } = ctx;
  if (noLines(ctx, "R-009")) return;
  const cur = p.currency;
  const read = p.invoice.lines.filter(
    (l): l is typeof l & PricedLine => l.qty !== null && l.unit_price !== null,
  );
  if (p.invoice.total === null || read.length !== p.invoice.lines.length) {
    // not in the rules table: arithmetic on an unread amount is never PASS
    add(
      "R-009",
      "UNKNOWN",
      "Sətirlərin cəmi və ya yekun məbləğ oxunmadı. Mənbəyə baxıb sahəni təsdiqləyin.",
      [E("invoice", "total")],
      { fix_hint: "edit_field" },
    );
    return;
  }
  const sum = sumLines(read);
  const total = cents(p.invoice.total);
  const diff = sum - total;
  if (Math.abs(diff) <= cents(r.tolerance))
    add("R-009", "PASS", `Sətirlərin cəmi ${money(sum, cur)} yekun məbləğə uyğundur.`, [
      E("invoice", "total"),
    ]);
  else
    add(
      "R-009",
      "FAIL",
      `Sətirlərin cəmi ${money(sum, cur)}, fakturadakı yekun ${money(total, cur)}. Fərq: ${money(diff, cur)}.`,
      [E("invoice", "total")],
      { fix_hint: "upload_invoice" },
    );
}
