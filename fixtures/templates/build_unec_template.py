"""Builds UNEC_qrant_xerc_akti.docx — the demo output template of fixtures/scenarios/unec.json.

Run from apps/api: `uv run python ../../fixtures/templates/build_unec_template.py`.
The zip entries get a fixed timestamp, so the file (and its sha256 in the fixtures) is
reproducible. Placeholders are plain `{{name}}` text in single runs, as docxtpl expects."""

import io
import zipfile
from pathlib import Path

from docx import Document

OUT = Path(__file__).with_name("UNEC_qrant_xerc_akti.docx")
EPOCH = (2026, 9, 1, 0, 0, 0)

doc = Document()
doc.add_heading("Tələbə qrantı üzrə xərc aktı", level=1)
doc.add_paragraph("Hesabat: {{report_reference}}")
doc.add_paragraph("Qrant alan: {{grantee_name}} (FİN {{grantee_fin}})")
doc.add_paragraph("Dövr: {{period_start}} — {{period_end}}")
doc.add_paragraph("Faktura sayı: {{invoice_count}}")
doc.add_paragraph("Cəmi xərc: {{total_spent}}")
doc.add_paragraph("Təsdiq edən: {{approved_by}}, tarix: {{approved_on}}")
doc.add_paragraph(
    "Bu akt PayProof tərəfindən mənbə sənədlərinə əsasən doldurulub; ödəniş təsdiqi deyil."
)
raw = io.BytesIO()
doc.save(raw)

# re-pack with fixed timestamps and order: python-docx stamps the current time
src = zipfile.ZipFile(io.BytesIO(raw.getvalue()))
out = io.BytesIO()
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for info in sorted(src.infolist(), key=lambda i: i.filename):
        data = src.read(info.filename)
        if info.filename == "docProps/core.xml":
            data = b"".join(data.split(b"<dcterms:created")[:1]) + data[data.rfind(b"</cp:coreProperties>"):]
        z.writestr(zipfile.ZipInfo(info.filename, EPOCH), data)
OUT.write_bytes(out.getvalue())
print(OUT.name)
