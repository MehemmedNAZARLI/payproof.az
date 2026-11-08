import type { Schemas } from "../../client";
import { decimal } from "../money";
import { customer, type DocType, type PackageModel, product } from "./model";
import {
  type Anchor,
  deliveryQuote,
  invoiceQuote,
  lineSum,
  money,
  orderQuote,
  quantity,
} from "./quotes";

// shortcut: the prototype's runChecks (R-001…R-009) ported for the mock's messages and
// evidence. checks.test.ts holds every outcome to fixtures/expected.json; S-06 replaces this.

type Outcome = Schemas["CheckOutcome"];
type FixHint = Schemas["CheckResult"]["fix_hint"];
export type RuleId = `R-00${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
export type EvidenceTarget = { doc: DocType; anchor: Anchor; quote: string };
export type Check = {
  ruleId: RuleId;
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
  let comparable = false;
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
    comparable = true;
    add("R-004", "PASS", `Valyuta (${cur}) və ölçü vahidləri uyğundur.`, [
      E("invoice", "total"),
      E("order", "total"),
    ]);
  }

  // R-005 · unit prices
  if (!comparable || !o)
    add(
      "R-005",
      "UNKNOWN",
      "Valyuta və vahid uyğunluğu təsdiqlənmədən qiymət müqayisə edilmir.",
      [],
      { cascade: true },
    );
  else {
    const missing = inv.lines.filter((l) => !o.lines.some((x) => x.code === l.code));
    const diffs = inv.lines.flatMap((l) => {
      const ol = o.lines.find((x) => x.code === l.code);
      return ol && ol.price !== l.price
        ? [{ l, ol, diff: (l.price - ol.price) * BigInt(l.qty) }]
        : [];
    });
    if (missing.length)
      add(
        "R-005",
        "UNKNOWN",
        `Sifarişdə olmayan sətir: ${missing.map((l) => l.code).join(", ")}. Avtomatik uyğun sayılmır.`,
        missing.map((l) => E("invoice", `line:${l.code}`)),
      );
    else if (diffs.length) {
      const total = diffs.reduce((s, x) => s + x.diff, 0n);
      add(
        "R-005",
        "FAIL",
        `${diffs.map((x) => `${x.l.code}: fakturada ${money(x.l.price, cur)}, sifarişdə ${money(x.ol.price, cur)} × ${quantity(x.l.qty)} = ${money(x.diff, cur)} fərq`).join("; ")}. Aktual qiymət əlavəsini yoxlayın. Fərq itki və ya gəlir sayılmır.`,
        diffs.flatMap((x) => [E("invoice", `line:${x.l.code}`), E("order", `line:${x.l.code}`)]),
        {
          fix: "upload_invoice",
          data: { line_difference: { amount: decimal(total), currency: cur } },
        },
      );
    } else {
      const first = inv.lines[0]!.code;
      add("R-005", "PASS", `${inv.lines.length} sətirdə vahid qiymət sifarişlə eynidir.`, [
        E("invoice", `line:${first}`),
        E("order", `line:${first}`),
      ]);
    }
  }

  // R-006 · quantities against the order and the delivery note
  if (!comparable || !o)
    add(
      "R-006",
      "UNKNOWN",
      "Miqdar müqayisəsi sifariş və vahid uyğunluğu təsdiqləndikdən sonra aparılır.",
      [],
      { cascade: true },
    );
  else {
    const dlOk = d !== null && d.poRef === o.po && d.customerId === m.customer.id;
    const problems: string[] = [];
    const evs: (EvidenceTarget | null)[] = [];
    for (const l of inv.lines) {
      const ol = o.lines.find((x) => x.code === l.code);
      const unit = product(l.code).unit;
      if (ol && ol.qty !== l.qty) {
        problems.push(
          `${l.code}: fakturada ${quantity(l.qty)}, sifarişdə ${quantity(ol.qty)} ${unit}`,
        );
        evs.push(E("invoice", `line:${l.code}`), E("order", `line:${l.code}`));
      }
      const dq = dlOk ? (d.lines.find((x) => x.code === l.code)?.qty ?? 0) : l.qty;
      if (dq !== l.qty) {
        problems.push(
          `${l.code}: fakturada ${quantity(l.qty)}, təhvil aktında ${quantity(dq)} ${unit}`,
        );
        evs.push(E("invoice", `line:${l.code}`), E("delivery", `line:${l.code}`));
      }
    }
    const first = inv.lines[0]!.code;
    if (problems.length)
      add(
        "R-006",
        "FAIL",
        `${problems.join("; ")}. Qismən çatdırılma P0-da avtomatik uyğun sayılmır.`,
        evs,
        { fix: "upload_invoice" },
      );
    else
      add(
        "R-006",
        "PASS",
        dlOk
          ? "Sifariş, faktura və təhvil miqdarları uyğundur."
          : "Faktura və sifariş miqdarları uyğundur; uyğun təhvil sənədi olmadığı üçün təhvil miqdarı müqayisə edilmədi.",
        [E("invoice", `line:${first}`), dlOk ? E("delivery", `line:${first}`) : null],
      );
  }

  // R-007 · delivery note present and tied to the order
  if (!r.requireDelivery)
    add("R-007", "NOT_APPLICABLE", "Müştəri qaydası təhvil sənədi tələb etmir.");
  else if (!d)
    add(
      "R-007",
      "FAIL",
      `Müştəri qaydası ${r.requireSignature ? "imzalanmış " : ""}təhvil sənədi tələb edir; paketdə təhvil sənədi yoxdur.`,
      [],
      { fix: "upload_delivery" },
    );
  else if (!o)
    add("R-007", "UNKNOWN", "Sifariş təsdiqlənmədən təhvil sənədinin bağlılığı yoxlanmır.", [], {
      cascade: true,
    });
  else if (d.poRef !== o.po)
    add(
      "R-007",
      "UNKNOWN",
      `${d.no} sənədində sifariş: ${d.poRef}; təsdiqlənmiş sifariş: ${o.po}. Uyğunluq təsdiqlənməyib.`,
      [E("delivery", "po"), E("order", "po")],
      { fix: "upload_delivery" },
    );
  else
    add("R-007", "PASS", `${d.no} paketdədir və ${o.po} sifarişinə bağlıdır.`, [
      E("delivery", "po"),
    ]);

  // R-008 · signature (a human looks at it; never an authenticity check)
  const r7 = out.find((c) => c.ruleId === "R-007")!.outcome;
  if (!r.requireSignature) add("R-008", "NOT_APPLICABLE", "Müştəri qaydası imza tələb etmir.");
  else if (!d)
    add("R-008", "NOT_APPLICABLE", "Təhvil sənədi olmadan imza yoxlanmır — R-007-yə baxın.");
  else if (r7 !== "PASS")
    add("R-008", "UNKNOWN", "Təhvil sənədinin uyğunluğu təsdiqlənmədən imza yoxlanmır.", [], {
      cascade: true,
    });
  else if (!d.signed)
    add(
      "R-008",
      "FAIL",
      "Təhvil aktında qəbul edənin imza sahəsi boşdur.",
      [E("delivery", "signature")],
      { fix: "upload_delivery" },
    );
  else if (!m.signatureReviewed)
    add(
      "R-008",
      "UNKNOWN",
      "İmza tələb olunur: əməkdaş sənədə baxıb imzanın mövcudluğunu təsdiqləməlidir.",
      [E("delivery", "signature")],
      { fix: "review_signature" },
    );
  else
    add(
      "R-008",
      "PASS",
      "Əməkdaş imzanın vizual mövcudluğunu təsdiqləyib. Bu, imzanın hüquqi autentifikasiyası deyil.",
      [E("delivery", "signature")],
    );

  // R-009 · line arithmetic against the invoice total
  const sum = lineSum(inv.lines);
  const diff = sum - inv.total;
  if ((diff < 0n ? -diff : diff) <= r.tolerance)
    add("R-009", "PASS", `Sətirlərin cəmi ${money(sum, cur)} yekun məbləğə uyğundur.`, [
      E("invoice", "total"),
    ]);
  else
    add(
      "R-009",
      "FAIL",
      `Sətirlərin cəmi ${money(sum, cur)}, fakturadakı yekun ${money(inv.total, cur)}. Fərq: ${money(diff, cur)}.`,
      [E("invoice", "total")],
      { fix: "upload_invoice" },
    );

  return out;
}
