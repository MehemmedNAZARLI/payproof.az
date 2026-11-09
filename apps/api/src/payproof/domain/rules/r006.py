"""R-006 — invoiced quantities equal the order's and, when the delivery note belongs to this
order and buyer, the delivered quantities. Partial delivery is not auto-accepted in P0."""

from decimal import Decimal

from payproof.domain.enums import CheckOutcome
from payproof.domain.format import format_qty
from payproof.domain.rules.paths import line
from payproof.domain.rules.result import CheckResult, FixHint, evidence_for, no_lines
from payproof.domain.snapshot import PackageSnapshot

RULE = "R-006"


def r006(s: PackageSnapshot, *, comparable: bool) -> CheckResult:
    """`comparable` is R-004's PASS (same currency and units)."""
    order, dl = s.order, s.delivery
    if not comparable or order is None:
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            "Miqdar müqayisəsi sifariş və vahid uyğunluğu təsdiqləndikdən sonra aparılır.",
            cascade=True,
        )
    if empty := no_lines(RULE, s):
        return empty
    linked = dl is not None and dl.po_ref == order.po and dl.customer_id == s.customer_id
    ordered = {ol.code: ol for ol in order.lines}
    delivered: dict[str, Decimal | None] = {dl_.code: dl_.qty for dl_ in dl.lines} if dl else {}
    invoice_codes = [li.code for li in s.invoice.lines]
    # (code, document) of every quantity that was not read
    unread = [(li.code, "invoice") for li in s.invoice.lines if li.qty is None]
    if linked:
        unread += [
            (c, "delivery") for c in invoice_codes if c in delivered and delivered[c] is None
        ]
    if unread:
        # not in the rules table: an unread quantity is never "quantities match"
        codes = dict.fromkeys(code for code, _ in unread)
        return CheckResult(
            RULE,
            CheckOutcome.UNKNOWN,
            f"Miqdar oxunmadı: {', '.join(codes)}. Mənbəyə baxıb sahəni təsdiqləyin.",
            evidence_for(s, *(line(doc, code, "qty") for code, doc in unread)),
            fix_hint=FixHint.EDIT_FIELD,
        )
    # (code, invoiced, "where", doc, other qty, unit)
    found: list[tuple[str, Decimal, str, str, Decimal, str | None]] = []
    for li in s.invoice.lines:
        qty, ol = li.qty or Decimal(0), ordered.get(li.code)
        unit = li.unit or (ol.unit if ol else None)
        if ol is not None and ol.qty != qty:
            found.append((li.code, qty, "sifarişdə", "order", ol.qty, unit))
        got = delivered.get(li.code) or Decimal(0)  # a missing delivery line counts as 0
        if linked and got != qty:
            found.append((li.code, qty, "təhvil aktında", "delivery", got, unit))
    problems = [
        f"{code}: fakturada {format_qty(q)}, {where} {format_qty(other)}" + (f" {u}" if u else "")
        for code, q, where, _, other, u in found
    ]
    paths = [
        p
        for code, _, _, doc, _, _ in found
        for p in (line("invoice", code, "qty"), line(doc, code, "qty"))
    ]
    if problems:
        return CheckResult(
            RULE,
            CheckOutcome.FAIL,
            f"{'; '.join(problems)}. Qismən çatdırılma P0-da avtomatik uyğun sayılmır.",
            evidence_for(s, *paths),
            fix_hint=FixHint.UPLOAD_INVOICE,
        )
    first = invoice_codes[0]
    return CheckResult(
        RULE,
        CheckOutcome.PASS,
        "Sifariş, faktura və təhvil miqdarları uyğundur."
        if linked
        else "Faktura və sifariş miqdarları uyğundur; uyğun təhvil sənədi olmadığı üçün "
        "təhvil miqdarı müqayisə edilmədi.",
        evidence_for(
            s, line("invoice", first, "qty"), *([line("delivery", first, "qty")] if linked else [])
        ),
    )
