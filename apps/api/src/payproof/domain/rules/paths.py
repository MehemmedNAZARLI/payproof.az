"""Field paths shared by extraction (`extracted_fields.field_path`), evidence and rules."""

INVOICE_PO = "invoice.po_ref"
INVOICE_CUSTOMER = "invoice.customer"
INVOICE_TOTAL = "invoice.total"
ORDER_PO = "order.po_number"
ORDER_CUSTOMER = "order.customer"
ORDER_TOTAL = "order.total"
DELIVERY_CUSTOMER = "delivery.customer"
DELIVERY_PO = "delivery.po_ref"
DELIVERY_SIGNATURE = "delivery.signed"


def line(doc: str, code: str, field: str) -> str:
    """`invoice.lines[KY-10].unit_price` (openapi ExtractedField.field_path)."""
    return f"{doc}.lines[{code}].{field}"
