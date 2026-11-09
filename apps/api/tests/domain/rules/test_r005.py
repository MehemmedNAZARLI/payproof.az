from decimal import Decimal

from payproof.domain.enums import CheckOutcome as O
from payproof.domain.rules.paths import line
from payproof.domain.rules.r005 import r005
from payproof.domain.rules.result import FixHint
from payproof.domain.snapshot import InvoiceLine, OrderLine
from tests.domain.builders import azn, evidence, invoice, order, snapshot


def _ev(*paths: str) -> dict[str, object]:
    return {"evidence": {p: evidence(p) for p in paths}}


def test_not_comparable_is_cascade_unknown() -> None:
    r = r005(snapshot(), comparable=False)
    assert (r.outcome, r.cascade, r.evidence) == (O.UNKNOWN, True, ())
    assert r.message == "Valyuta və vahid uyğunluğu təsdiqlənmədən qiymət müqayisə edilmir."


def test_line_missing_from_order_is_unknown() -> None:
    extra = InvoiceLine("KY-10", Decimal("5"), "ədəd", azn("1.00"))
    paths = (line("invoice", "KY-10", "unit_price"),)
    s = snapshot(invoice=invoice(lines=(*invoice().lines, extra)), **_ev(*paths))
    r = r005(s, comparable=True)
    assert (r.outcome, r.cascade, r.fix_hint) == (O.UNKNOWN, False, None)
    assert r.message == "Sifarişdə olmayan sətir: KY-10. Avtomatik uyğun sayılmır."
    assert r.evidence == tuple(evidence(p) for p in paths)


def test_unread_price_is_unknown_not_pass() -> None:
    lines = (InvoiceLine("GY-1L", Decimal("800"), "ədəd", None), invoice().lines[1])
    r = r005(snapshot(invoice=invoice(lines=lines)), comparable=True)
    assert (r.outcome, r.fix_hint) == (O.UNKNOWN, FixHint.EDIT_FIELD)
    assert (
        r.message == "Vahid qiymət və ya miqdar oxunmadı: GY-1L. Mənbəyə baxıb sahəni təsdiqləyin."
    )


def test_price_difference_fails_with_line_difference() -> None:
    # INV-1044: KY-10 invoiced at 110.00, ordered at 100.00, 50 pieces -> 500.00
    inv = invoice(lines=(InvoiceLine("KY-10", Decimal("50"), "ədəd", azn("110.00")),))
    o = order(lines=(OrderLine("KY-10", Decimal("50"), "ədəd", azn("100.00")),))
    paths = (line("invoice", "KY-10", "unit_price"), line("order", "KY-10", "unit_price"))
    r = r005(snapshot(invoice=inv, order=o, delivery=None, **_ev(*paths)), comparable=True)
    assert r.outcome is O.FAIL
    assert r.message == (
        "KY-10: fakturada 110,00 AZN, sifarişdə 100,00 AZN × 50 = 500,00 AZN fərq. "
        "Aktual qiymət əlavəsini yoxlayın. Fərq itki və ya gəlir sayılmır."
    )
    assert r.data == {"line_difference": {"amount": "500.00", "currency": "AZN"}}
    assert r.fix_hint is FixHint.UPLOAD_INVOICE
    assert r.evidence == tuple(evidence(p) for p in paths)


def test_differences_are_summed_and_can_be_negative() -> None:
    inv = invoice(
        lines=(
            InvoiceLine("GY-1L", Decimal("800"), "ədəd", azn("9.10")),
            InvoiceLine("DY-5", Decimal("400"), "ədəd", azn("11.50")),
        )
    )
    r = r005(snapshot(invoice=inv), comparable=True)
    assert r.message.startswith(
        "GY-1L: fakturada 9,10 AZN, sifarişdə 9,00 AZN × 800 = 80,00 AZN fərq; "
        "DY-5: fakturada 11,50 AZN, sifarişdə 12,00 AZN × 400 = −200,00 AZN fərq."
    )
    assert r.data == {"line_difference": {"amount": "-120.00", "currency": "AZN"}}


def test_same_prices_pass() -> None:
    paths = (line("invoice", "GY-1L", "unit_price"), line("order", "GY-1L", "unit_price"))
    r = r005(snapshot(**_ev(*paths)), comparable=True)
    assert (r.rule_id, r.outcome, r.message) == (
        "R-005",
        O.PASS,
        "2 sətirdə vahid qiymət sifarişlə eynidir.",
    )
    assert r.evidence == tuple(evidence(p) for p in paths)
