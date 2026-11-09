# Qayda mühərriki — spesifikasiya

Referans implementasiya: prototipdəki `runChecks(p)` və `info(p)` funksiyaları (`docs/product/prototype/payproof-prototype.html`). Backend versiyası **eyni nəticələri** verməlidir — golden test bunu yoxlayır (B-08).

## Giriş: `PackageSnapshot` (təmiz data)
- `currency`, `customer_id`
- `invoice`: `po_ref | None`, `po_raw | None`, `unreadable_fields: set[str]`, `lines[{code, qty, unit, unit_price: Decimal}]`, `total: Decimal`
- `order | None` — **yalnız əlaqə insan və ya dəqiq ID ilə təsdiqlənibsə**: `po`, `customer_id`, `currency`, `lines`
- `candidates: list[po]` — əlaqə təsdiqlənməyibsə
- `delivery | None`: `no`, `po_ref`, `customer_id`, `lines[{code, qty}]`, `signed: bool`
- `signature_reviewed: bool`
- `rules`: `require_po`, `require_delivery`, `require_signature`, `tolerance: Decimal`
- `parties: {customer_id: {name, voen}}` — yuxarıda istinad edilən hər müştəri üçün (R-003 mesajı hər iki alıcının adını və VÖEN-i göstərir)
- `evidence: {field_path: {document_version_id, page, quote, bbox}}` — qaydaların `evidence[]`-i buradan götürülür
- Oxunmayan dəyər `None`-dur (qayda `UNKNOWN` verir); pul `Money` (valyuta ilə), miqdar `Decimal`

## Çıxış
`CheckResult{rule_id, outcome, severity="BLOCKING", message, evidence[], cascade: bool, fix_hint, data}` — `data` hesablanmış dəyərləri saxlayır (məs. `line_difference`).

`cascade=true`: nəticə başqa problemə görə aparıla bilmədi. Paketi bloklayır, amma "əsas problem" sayılmır (dashboard sayğaclarına düşmür).

## Qaydalar
| ID | Şərt → nəticə |
|---|---|
| **R-001** | `!require_po` → NA · PO sahəsi oxunmayıb → UNKNOWN (fix: sahəni düzəlt) · `po_ref` yoxdur → FAIL · əks halda PASS |
| **R-002** | order yoxdur → UNKNOWN (1-dən çox namizəd varsa mesaj bunu deyir; fix: link) · PO oxunmayıb → UNKNOWN cascade · `po_ref` yoxdur → NA · `po_ref != order.po` → FAIL · PASS |
| **R-003** | delivery və ya order başqa müştəriyə aiddir → FAIL · order yoxdur → UNKNOWN cascade · PASS |
| **R-004** | order yoxdur → UNKNOWN cascade · `order.currency != currency` → UNKNOWN (avtomatik çevirmə yoxdur) · vahid fərqi → UNKNOWN · PASS (`comparable=true`) |
| **R-005** | `!comparable` → UNKNOWN cascade · sifarişdə olmayan sətir → UNKNOWN · qiymət fərqi → FAIL, `diff = Σ (inv_price − ord_price) × inv_qty` · PASS |
| **R-006** | `!comparable` → UNKNOWN cascade · faktura≠sifariş miqdarı → FAIL · delivery uyğundursa (eyni PO + eyni müştəri) faktura≠təhvil miqdarı → FAIL · PASS (delivery yoxdursa mesaj bunu qeyd edir) |
| **R-007** | `!require_delivery` → NA · delivery yoxdur → FAIL (fix: yüklə) · order yoxdur → UNKNOWN cascade · `delivery.po_ref != order.po` → UNKNOWN · PASS |
| **R-008** | `!require_signature` → NA · delivery yoxdur → NA · R-007 ≠ PASS → UNKNOWN cascade · imza boşdur → FAIL · `!signature_reviewed` → UNKNOWN (fix: imzaya bax) · PASS |
| **R-009** | `abs(Σ qty×price − total) <= tolerance` → PASS · əks halda FAIL |

## R-010 və paket statusu (törədilir, saxlanmır)
```
if processing:                      PROCESSING
elif not link_confirmed:            NEEDS_REVIEW
elif any FAIL:                      NEEDS_FIX
elif any UNKNOWN:                   NEEDS_REVIEW
elif valid approval for (current version, current rule version):
    EXPORTED if export exists for current version else APPROVED_READY
else:                               READY_FOR_APPROVAL
```
Rule version: paket cari versiyada ixrac edilibsə, ixrac zamanı qüvvədə olan qayda versiyası; əks halda müştərinin son qayda dəsti.

## Qaydalar haqqında prinsiplər
- Hesablama yalnız `Decimal` ilə; yuvarlaqlaşdırma `ROUND_HALF_UP`, 2 onluq (AZN, USD).
- Vahidlər yalnız təsdiqlənmiş çevirmə qaydası olduqda çevrilir (P0-da yoxdur → UNKNOWN).
- Valyutalar heç vaxt avtomatik çevrilmir.
- Mesajlar Azərbaycan dilindədir, nömrədən sonra şəkilçi qoyulmur ("PO-381 sifarişinə" yox, "sifariş: PO-381").
- Mesaj yeni rəqəm uydurmur — yalnız `data`-dakı hesablanmış dəyərləri göstərir.
- Hər qayda ayrıca funksiyadır: `def r001(s: PackageSnapshot) -> CheckResult`. `evaluate(s) -> list[CheckResult]` onları ardıcıl çağırır (R-008 R-007-nin nəticəsindən asılıdır).

## Tapşırıqların avtomatik bağlanması
Hər validation run-dan sonra: həmin paketin açıq tapşırıqları üçün `task.rule_id` nəticəsi `PASS` və ya `NOT_APPLICABLE`-dirsə → `RESOLVED` (actor: system). `SUBMITTED_FOR_RECHECK` vəziyyətindəki tapşırıq qaydası hələ keçmirsə → `IN_PROGRESS` (audit: "yoxlama keçmədi").
