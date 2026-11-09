from payproof.domain.enums import CheckOutcome as O
from payproof.domain.rules.r001 import r001
from payproof.domain.rules.result import FixHint
from tests.domain.builders import evidence, invoice, rules, snapshot

UNREAD = frozenset({"invoice.po_ref"})


def test_not_required_is_not_applicable_even_if_unread() -> None:
    r = r001(snapshot(rules=rules(require_po=False), invoice=invoice(unreadable_fields=UNREAD)))
    assert (r.outcome, r.message) == (
        O.NOT_APPLICABLE,
        "Müştəri qaydası sifariş nömrəsini tələb etmir.",
    )


def test_unread_po_is_unknown_with_field_fix() -> None:
    # INV-1047: scan, PO field not read
    r = r001(snapshot(invoice=invoice(po_ref=None, po_raw="PO-3?7", unreadable_fields=UNREAD)))
    assert r.outcome is O.UNKNOWN
    assert r.message == (
        "PO sahəsi skanda oxunmadı. Mənbəyə baxıb sahəni təsdiqləyin "
        "və ya müştəridən aydın nüsxə istəyin."
    )
    assert (r.fix_hint, r.evidence, r.cascade) == (
        FixHint.EDIT_FIELD,
        (evidence("invoice.po_ref"),),
        False,
    )


def test_missing_po_fails_with_upload_fix() -> None:
    # INV-1042 v1: no PO on the invoice
    r = r001(snapshot(invoice=invoice(po_ref=None)))
    assert r.outcome is O.FAIL
    assert r.message == (
        "Müştəri qaydası fakturada sifariş nömrəsi tələb edir, fakturada isə PO göstərilməyib."
    )
    assert r.fix_hint is FixHint.UPLOAD_INVOICE


def test_present_po_passes() -> None:
    r = r001(snapshot())
    assert (r.rule_id, r.outcome, r.message) == (
        "R-001",
        O.PASS,
        "Fakturada sifariş nömrəsi var: PO-381.",
    )
    assert (r.evidence, r.fix_hint) == ((evidence("invoice.po_ref"),), None)
