"""Order matching. Priority: the exact PO of the same customer (linked automatically), then
the same customer's orders with the same product codes and quantities — suggested, never
chosen: a person confirms. The reason text only explains; it never decides."""

import uuid
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from payproof.domain.format import format_qty
from payproof.domain.rules.paths import INVOICE_PO
from payproof.repositories import package_reads as reads
from payproof.repositories.models import ExtractedInvoiceLine, InvoicePackage, Order, OrderLine


@dataclass(frozen=True)
class Candidate:
    order: Order
    total: Decimal
    reason: str


async def exact_order(
    session: AsyncSession, pkg: InvoicePackage, po_ref: str | None
) -> Order | None:
    if po_ref is None:
        return None
    return await session.scalar(
        select(Order).where(Order.po_number == po_ref, Order.customer_id == pkg.customer_id)
    )


def _match_text(lines: dict[str, Decimal]) -> str:
    if len(lines) == 1:
        [(code, qty)] = lines.items()
        return f"məhsul kodu {code} və miqdar ({format_qty(qty)}) uyğundur"
    both = "hər iki" if len(lines) == 2 else "bütün"
    return f"{both} məhsul kodu ({', '.join(lines)}) və miqdarlar uyğundur"


async def candidates(session: AsyncSession, pkg: InvoicePackage) -> list[Candidate]:
    """Empty once the link is confirmed, before extraction, or when the exact PO exists."""
    invoices, unread = await reads.invoices(session, [pkg.id])
    inv = invoices.get(pkg.id)
    if pkg.order_id is not None or inv is None:
        return []
    if await exact_order(session, pkg, inv.po_ref):
        return []  # exact_id: linked without asking (link_exact)
    wanted = {
        li.product_code: li.qty
        for li in await session.scalars(
            select(ExtractedInvoiceLine).where(ExtractedInvoiceLine.extracted_invoice_id == inv.id)
        )
        if li.qty is not None
    }
    if not wanted:
        return []
    rows = await session.execute(
        select(Order, OrderLine)
        .join(OrderLine, OrderLine.order_id == Order.id)
        .where(Order.customer_id == pkg.customer_id)
        .order_by(Order.order_date, Order.po_number)
    )
    lines: defaultdict[uuid.UUID, dict[str, Decimal]] = defaultdict(dict)
    totals: defaultdict[uuid.UUID, Decimal] = defaultdict(Decimal)
    orders: dict[uuid.UUID, Order] = {}
    for order, li in rows.all():
        orders[order.id] = order
        lines[order.id][li.product_code] = li.qty
        totals[order.id] += li.qty * li.unit_price
    note = await reads.latest_delivery(session, pkg.id)
    extra = ""
    if (inv.document_version_id, INVOICE_PO) in unread:
        extra = " PO sahəsi skanda oxunmadı."
    elif inv.po_ref:
        extra = f" Fakturadakı {inv.po_ref} sistemdə tapılmadı."
    out = []
    for oid, order in orders.items():
        if lines[oid] != wanted:
            continue
        reason = f"Alıcı, {_match_text(wanted)}. Sifariş tarixi: {order.order_date:%d.%m.%Y}."
        if note and note.po_ref == order.po_number and note.note_number:
            reason += f" {note.note_number} təhvil aktı bu sifarişə istinad edir."
        out.append(Candidate(order, totals[oid].quantize(Decimal("0.01")), reason + extra))
    return out
