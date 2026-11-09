import io
import zipfile

from docx import Document

from payproof.services.output_fill import render


def template(*texts: str) -> bytes:
    doc = Document()
    for t in texts:
        doc.add_paragraph(t)
    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def text(data: bytes) -> list[str]:
    return [p.text for p in Document(io.BytesIO(data)).paragraphs]


def test_values_are_escaped_and_unmapped_placeholders_stay() -> None:
    out = render(template("Ad: {{name}}", "Qalır: {{other}}"), {"{{name}}": "A & B <x/>"})
    assert text(out) == ["Ad: A & B <x/>", "Qalır: {{other}}"]
    xml = zipfile.ZipFile(io.BytesIO(out)).read("word/document.xml").decode()
    assert "A &amp; B &lt;x/&gt;" in xml  # Word XML is never injected


def test_template_code_cannot_reach_python_objects() -> None:
    out = render(template("{{ name.__class__ }}", "{{ name }}"), {"{{name}}": "x"})
    assert text(out) == ["{{__class__}}", "x"]  # blocked by the sandbox: nothing leaks
