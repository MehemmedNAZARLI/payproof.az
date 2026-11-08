# ADR-0007: Sənəd çıxarışı adapter arxasında
**Status:** qəbul edilib · 2026-11-08

**Qərar:** `ExtractionAdapter` protokolu: `extract(document_version) -> ExtractionResult(fields, lines, evidence, unreadable, warnings)`. İmplementasiyalar:
- `MockExtractionAdapter` — fixtures-dan əvvəlcədən hazırlanmış nəticə; UI-də "əvvəlcədən hazırlanmış nəticə (mock adapter)" kimi etiketlənir. Default.
- `PdfTextAdapter` — PDF mətn qatı (PyMuPDF), CSV/XLSX parser.
- `OcrAdapter` — Tesseract (`aze`, `eng`).
- `LlmAdapter` — strukturlaşdırılmış JSON çıxışı; provayder `AI_PROVIDER` env ilə seçilir (P0 stretch, B-25).
Seçim: `AI_PROVIDER=mock|pdf|llm`. Nəticə həmişə JSON sxem + mənbə validasiyasından keçir. Model nəticəsi qayda mühərrikinə birbaşa təsir etmir — yalnız strukturlaşdırılmış sahələr vasitəsilə.
