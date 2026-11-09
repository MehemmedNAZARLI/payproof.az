// R-001 PO present, R-002 PO matches the confirmed order.
import type { Ctx } from "./index";

export function r001({ r, p, poUnread, add, E }: Ctx) {
  const po = p.invoice.po_ref;
  if (!r.require_po)
    add("R-001", "NOT_APPLICABLE", "Müştəri qaydası sifariş nömrəsini tələb etmir.");
  else if (poUnread)
    add(
      "R-001",
      "UNKNOWN",
      "PO sahəsi skanda oxunmadı. Mənbəyə baxıb sahəni təsdiqləyin və ya müştəridən aydın nüsxə istəyin.",
      [E("invoice", "po")],
      { fix_hint: "edit_field" },
    );
  else if (!po)
    add(
      "R-001",
      "FAIL",
      "Müştəri qaydası fakturada sifariş nömrəsi tələb edir, fakturada isə PO göstərilməyib.",
      [E("invoice", "po")],
      { fix_hint: "upload_invoice" },
    );
  else add("R-001", "PASS", `Fakturada sifariş nömrəsi var: ${po}.`, [E("invoice", "po")]);
}

export function r002({ o, p, poUnread, add, E }: Ctx) {
  const po = p.invoice.po_ref;
  if (!o) {
    const n = p.candidates.length;
    add(
      "R-002",
      "UNKNOWN",
      n > 1
        ? `${n} mümkün sifariş tapıldı — düzgün sifarişi insan seçməlidir.`
        : "Təklif olunan sifariş əlaqəsi hələ insan tərəfindən təsdiqlənməyib.",
      [],
      { fix_hint: "link_order" },
    );
  } else if (poUnread)
    add("R-002", "UNKNOWN", "Fakturadakı PO oxunmadığı üçün müqayisə aparılmır.", [], {
      cascade: true,
    });
  else if (!po) add("R-002", "NOT_APPLICABLE", "Fakturada PO yoxdur — R-001-ə baxın.");
  else if (po !== o.po_number)
    add(
      "R-002",
      "FAIL",
      `Fakturadakı ${po} təsdiqlənmiş sifarişə (${o.po_number}) uyğun deyil.`,
      [E("invoice", "po"), E("order", "po")],
      { fix_hint: "upload_invoice" },
    );
  else
    add("R-002", "PASS", `${po} təsdiqlənmiş sifarişə uyğundur.`, [
      E("invoice", "po"),
      E("order", "po"),
    ]);
}
