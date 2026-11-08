import type { Schemas } from "../../client";
import { customer, type DocType, type PackageModel } from "./model";
import { type Anchor, deliveryQuote, invoiceQuote, orderQuote } from "./quotes";

// shortcut: the prototype's runChecks (R-001…R-004 so far) ported for the mock's messages and
// evidence. checks.test.ts holds every outcome to fixtures/expected.json; S-06 replaces this.

type Outcome = Schemas["CheckOutcome"];
type FixHint = Schemas["CheckResult"]["fix_hint"];
export type EvidenceTarget = { doc: DocType; anchor: Anchor; quote: string };
export type Check = {
  ruleId: Schemas["RuleId"];
  outcome: Outcome;
  cascade: boolean;
  message: string;
  evidence: EvidenceTarget[];
  fixHint: FixHint;
  data: Record<string, unknown>;
};

type Extra = { cascade?: boolean; fix?: FixHint; data?: Record<string, unknown> };

export function runChecks(m: PackageModel): Check[] {
  const { invoice: inv, order: o, delivery: d, rules: r, currency: cur } = m;
  const out: Check[] = [];
  const add = (
    ruleId: Check["ruleId"],
    outcome: Outcome,
    message: string,
    evidence: (EvidenceTarget | null)[] = [],
    x: Extra = {},
  ) =>
    out.push({
      ruleId,
      outcome,
      message,
      evidence: evidence.filter((e): e is EvidenceTarget => e !== null),
      cascade: x.cascade ?? false,
      fixHint: x.fix ?? null,
      data: x.data ?? {},
    });
  const E = (doc: DocType, anchor: Anchor): EvidenceTarget | null => {
    const quote =
      doc === "invoice"
        ? invoiceQuote(m, anchor)
        : doc === "order"
          ? o && orderQuote(o, anchor)
          : d && deliveryQuote(d, anchor);
    return quote === null ? null : { doc, anchor, quote };
  };

  // R-001 · PO on the invoice
  if (!r.requirePo)
    add("R-001", "NOT_APPLICABLE", "Müştəri qaydası sifariş nömrəsini tələb etmir.");
  else if (inv.poUnreadable)
    add(
      "R-001",
      "UNKNOWN",
      "PO sahəsi skanda oxunmadı. Mənbəyə baxıb sahəni təsdiqləyin və ya müştəridən aydın nüsxə istəyin.",
      [E("invoice", "po")],
      { fix: "edit_field" },
    );
  else if (!inv.poRef)
    add(
      "R-001",
      "FAIL",
      "Müştəri qaydası fakturada sifariş nömrəsi tələb edir, fakturada isə PO göstərilməyib.",
      [E("invoice", "po")],
      { fix: "upload_invoice" },
    );
  else add("R-001", "PASS", `Fakturada sifariş nömrəsi var: ${inv.poRef}.`, [E("invoice", "po")]);

  // R-002 · PO matches the confirmed order
  const candidates = m.fixture.candidates.length;
  if (!o)
    add(
      "R-002",
      "UNKNOWN",
      candidates > 1
        ? `${candidates} mümkün sifariş tapıldı — düzgün sifarişi insan seçməlidir.`
        : "Təklif olunan sifariş əlaqəsi hələ insan tərəfindən təsdiqlənməyib.",
      [],
      { fix: "link_order" },
    );
  else if (inv.poUnreadable)
    add("R-002", "UNKNOWN", "Fakturadakı PO oxunmadığı üçün müqayisə aparılmır.", [], {
      cascade: true,
    });
  else if (!inv.poRef) add("R-002", "NOT_APPLICABLE", "Fakturada PO yoxdur — R-001-ə baxın.");
  else if (inv.poRef !== o.po)
    add(
      "R-002",
      "FAIL",
      `Fakturadakı ${inv.poRef} təsdiqlənmiş sifarişə (${o.po}) uyğun deyil.`,
      [E("invoice", "po"), E("order", "po")],
      { fix: "upload_invoice" },
    );
  else
    add("R-002", "PASS", `${inv.poRef} təsdiqlənmiş sifarişə uyğundur.`, [
      E("invoice", "po"),
      E("order", "po"),
    ]);

  // R-003 · same buyer everywhere
  const wrongDl = d !== null && d.customerId !== m.customer.id;
  const wrongO = o !== null && o.customerId !== m.customer.id;
  if (wrongDl || wrongO) {
    const other = customer((wrongDl ? d : o)!.customerId).name;
    add(
      "R-003",
      "FAIL",
      `${wrongDl ? "Təhvil sənədi" : "Sifariş"} başqa alıcıya — ${other} — aid ola bilər. Faktura alıcısı: ${m.customer.name}.`,
      [E("invoice", "customer"), wrongDl ? E("delivery", "customer") : E("order", "customer")],
      { fix: wrongDl ? "upload_delivery" : null },
    );
  } else if (!o)
    add("R-003", "UNKNOWN", "Sifariş təsdiqlənmədən tərəflər müqayisə olunmur.", [], {
      cascade: true,
    });
  else
    add("R-003", "PASS", `Alıcı (VÖEN ${m.customer.voen}) bütün sənədlərdə eynidir.`, [
      E("invoice", "customer"),
      E("order", "customer"),
      E("delivery", "customer"),
    ]);

  // R-004 · currency and units
  if (!o)
    add("R-004", "UNKNOWN", "Sifariş təsdiqlənmədən valyuta və vahid müqayisə olunmur.", [], {
      cascade: true,
    });
  else if (o.currency !== cur)
    add(
      "R-004",
      "UNKNOWN",
      `Faktura ${cur}, sifariş ${o.currency} ilə tərtib olunub. Valyuta avtomatik çevrilmir — qiymət müqayisəsi dayandırıldı.`,
      [E("invoice", "total"), E("order", "total")],
      { fix: "upload_invoice" },
    );
  else {
    add("R-004", "PASS", `Valyuta (${cur}) və ölçü vahidləri uyğundur.`, [
      E("invoice", "total"),
      E("order", "total"),
    ]);
  }

  return out;
}
