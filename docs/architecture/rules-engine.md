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

## Konfiqurasiya olunan yoxlamalar (ADR-0011)
R-001…R-009 yuxarıdakı kimi qalır (ID, davranış, golden test). Müştərinin tələb dəsti ümumi sənəd dəsti istifadə edirsə, mühərrik əlavə olaraq:
- **`D-001` `document_count`** — `documents[]`-dən avtomatik: hər növün sayı `min_count..max_count` daxilində.
- **Konfiqurasiya olunmuş yoxlamalar** (`checks[]`, sıra ilə) — hər biri kitabxana ailəsinin parametrli nüsxəsidir: `field_present`, `values_equal`, `totals_sum`, `date_within_period`, `amount_within_limit`, `line_items_match`, `transaction_match`, `no_duplicate_use`, `party_identity_match`. Ailələrin parametrləri və nəticə məntiqi: ADR-0011 §3 və `fixtures/config/check-library.json`.

Giriş `GenericSnapshot`: sənədlər (`type`, `fields`, `unreadable`, `tables`, `evidence`), tələb dəsti, müştərinin digər paketləri (`no_duplicate_use`, `scope: customer`). Ümumi qaydalar R-qaydaları ilə eyni prinsiplərə tabedir:
- Dəyər yalnız oxunubsa və mənbə istinadı varsa "oxunmuş" sayılır; oxunmayan → `UNKNOWN`, olmayan → `FAIL` (`field_present`) və ya `UNKNOWN` (müqayisə qaydaları).
- Pul tam qəpiklə; valyuta fərqi → `UNKNOWN` və ya `FAIL` (`values_equal(currency)`), heç vaxt çevirmə.
- `transaction_match`: əvvəl birmənalı cütlər bağlanır (təkrarən), nəticə sənəd sırasından asılı deyil; iki sənədin yeganə namizədi olan əməliyyat heç kimə verilmir; birdən çox namizəd → `UNKNOWN` (insan seçir), namizəd yoxdur → `FAIL` + ən yaxın əməliyyat və fərq `data`-da; çıxarışda oxunmayan sətir varsa cütsüz sənəd `FAIL` yox, `UNKNOWN`-dur.
- Boş və ya oxunmayan cədvəl, oxunmayan valyuta, birmənalı olmayan dövr sərhədi `NOT_APPLICABLE` deyil, `UNKNOWN`-dur; `NOT_APPLICABLE` yalnız həmin növdən sənəd olmayanda. Məbləğlər yalnız eyni valyutada müqayisə olunur.
- Hər qərar verilmiş nəticə (`PASS/FAIL/UNKNOWN`) `evidence[]` daşıyır — müqayisə olunan hər dəyərin mənbəyi.
- Status: `FAIL` → `NEEDS_FIX`, `UNKNOWN` → `NEEDS_REVIEW`, əks halda `READY_FOR_APPROVAL` (sifariş əlaqəsi yoxdur); təsdiq/ixrac R-010 kimi.

Referans implementasiya `packages/mocks/src/checks/` (golden: `fixtures/scenarios/unec.expected.json`); backend eyni nəticəni verməlidir.

## Tapşırıqların avtomatik bağlanması
Hər validation run-dan sonra: həmin paketin açıq tapşırıqları üçün `task.rule_id` nəticəsi `PASS` və ya `NOT_APPLICABLE`-dirsə → `RESOLVED` (actor: system). `SUBMITTED_FOR_RECHECK` vəziyyətindəki tapşırıq qaydası hələ keçmirsə → `IN_PROGRESS` (audit: "yoxlama keçmədi").
