# ADR-0011: Konfiqurasiya olunan sənəd dəstləri — sənəd növü reyestri, tələb dəsti, yoxlama kitabxanası, çıxış şablonu
**Status:** qəbul edilib · 2026-11-09 · ADR-0007-nin provayder seçimi hissəsini əvəz edir

**Kontekst:** PayProof indiyə qədər yalnız bir sənəd dəstini tanıyırdı: faktura + sifariş + təhvil (R-001…R-009). Sənəd növləri `DocumentType` enum-u, çıxarış sxemi `extracted_invoices/delivery_notes` cədvəlləri, qaydalar isə üç bayraq (`require_po/delivery/signature`) ilə kodda bərkidilib. Müştərilər isə başqa dəstlər tələb edir: qrant hesabatı (faktura + bank çıxarışı + kart çıxarışı → akt), xərc avansı (qəbz + kart çıxarışı), müqavilə üzrə ödəniş (müqavilə + faktura + təhvil) və s. Hər yeni dəst üçün kod yazmaq məhsulu xidmət layihəsinə çevirir. Məhsul eyni qalmalıdır: **AI yalnız çıxarır, deterministik qaydalar qərar verir, hər nəticədə mənbə sübutu var, insan təsdiqləyir, ixrac cari versiyaya bağlıdır.**

## Qərar

### 1. Sənəd növü reyestri (konfiqurasiya, kod yox)
Hər sənəd növü bir reyestr qeydidir (`fixtures/config/document-types.json`, sxem `fixtures/schema/config/document-types.json`):
- `key` (`bank_statement`), `name`, `version`, `builtin`, `accepted_formats` (MIME; security.md-dəki ağ siyahının alt çoxluğu, məzmuna görə yoxlanır).
- `extraction`: `fields[]` (`key, label, type, critical`), `tables[]` (sətir cədvəli, sütunlar sahə kimi), `transaction_lists[]` (əməliyyat siyahısı — standart sütunlar `date, amount, direction, counterparty` məcburidir, əlavə sütun ola bilər).
- Sahə tipləri: `text, date, money, decimal, integer, boolean, currency, party`. `money` həmişə string + sənədin `currency` sahəsi; `party` = `{name, tax_id?, id_number?}`.
- `instructions`: çıxarış göstərişi — yalnız sahələri necə tapmağı izah edir; təhlükəsizlik prompt-u (security.md §AI) dəyişməz prefiks kimi həmişə əvvələ qoyulur və reyestrdən dəyişdirilə bilməz.

Mövcud `invoice`, `order`, `delivery` reyestrin `builtin: true` qeydləridir; əlavə nümunələr: `bank_statement`, `card_statement`, `contract`, `receipt`. Reyestr versiyalanır: növün sxemi dəyişəndə `version` artır, köhnə sənəd versiyası öz çıxarış sxemi versiyasını saxlayır (yenidən çıxarış yalnız yeni sənəd versiyası ilə).

### 2. Tələb dəsti = müştəri konfiqurasiyası
`requirement_sets` dəyişməz və versiyalı qalır (ADR-0009 olduğu kimi). Yeni sahələr:
- `documents[]`: `{type, min_count, max_count|null}` — tələb olunan sənəd növləri.
- `checks[]`: `{id, type, title, parameters}` — aktiv yoxlamalar; `id` müştəri daxilində sabitdir (`U-07`), `type` kitabxana ailəsidir.
- `output|null`: `.docx` şablonu (`template.file_name, template.sha256`), `placeholders[]` (`placeholder → source`) və `submission` (`channel: email`, `address`).

Köhnə bayraqlar (`require_po/delivery/signature`, `tolerance`) **legacy profil** kimi qalır: bayraqlı dəst `documents = [invoice 1..1, order 0..1, delivery (require_delivery ? 1 : 0)..1]` və `checks = R-001…R-009` (`type: legacy_rule`) kimi ifadə olunur. Mövcud müştərilərin (c1, c2) datası, qayda nəticələri və golden testləri dəyişmir.

Sistem hər dəst üçün `D-001` (`document_count`) yoxlamasını `documents[]`-dən avtomatik törədir — ayrıca konfiqurasiya edilmir.

### 3. Yoxlama kitabxanası — parametrli ümumi qaydalar
`fixtures/config/check-library.json` ailələri (hamısı deterministik, `Decimal`, valyuta çevrilmir, `UNKNOWN ≠ PASS`):

| `type` | Parametrlər (qısa) | Nəticə məntiqi | R-qaydası ilə əlaqə |
|---|---|---|---|
| `document_count` | `documents[]`-dən | say aralıqdan kənar → FAIL | R-007-nin "sənəd var" hissəsi |
| `field_present` | `targets[]: FieldRef` | oxunmayıb → UNKNOWN · yoxdur → FAIL | R-001 |
| `values_equal` | `fields[] (≥2)`, `tolerance`, `normalize` | oxunmayan → UNKNOWN · fərq > tolerans → FAIL | R-002 |
| `totals_sum` | `document_type, table, amount_column, total_field, tolerance` | `abs(Σ − total) > tolerance` → FAIL | R-009 |
| `date_within_period` | `target`, `period {from, to}` (tarix və ya FieldRef) | aralıqdan kənar → FAIL | — |
| `amount_within_limit` | `target`, `aggregate: each\|sum`, `limit: Money` | valyuta fərqli → UNKNOWN · limitdən çox → FAIL | — |
| `line_items_match` | `left, right, key_column, compare[], tolerance` | sətir yoxdur → UNKNOWN · fərq → FAIL | R-004/R-005/R-006 |
| `transaction_match` | `source {…}, against[], amount_tolerance, date_window_days, counterparty, direction` | uyğun əməliyyat yoxdur → FAIL · birdən çox namizəd → UNKNOWN (insan seçir) | — |
| `no_duplicate_use` | `subjects[] {document_type, key_fields[]}`, `scope: package\|customer` | eyni açar ikinci dəfə → FAIL | — |
| `party_identity_match` | `parties[]: FieldRef`, `match_on[]` | identifikator fərqli → FAIL · yoxdur → UNKNOWN | R-003 |

**R-qaydaları ID-lərini və davranışını saxlayır.** Onlar kitabxanada `legacy_rule` kimi qeyd olunur və öz implementasiyası ilə işləyir (golden test, B-08); cədvəldəki əlaqə yalnız konseptual xəritədir — R-qaydası ümumi ailə ilə yenidən yazılmır. `RuleId` müqavilədə `^[A-Z]{1,4}-[0-9]{2,3}$`-ə genişlənir (`R-001`, `D-001`, `U-07` hamısı keçərlidir).

Hər nəticə `evidence[]` daşıyır: PASS/FAIL/UNKNOWN nəticəsi müqayisə etdiyi hər dəyərin mənbəyinə (sənəd versiyası, səhifə, sitat) istinad edir. Yeganə istisna — heç bir sənədi olmayan növ üçün `D-001` FAIL (istinad ediləcək mənbə yoxdur; `data.missing` növü göstərir). Mesaj yalnız `data`-dakı hesablanmış dəyərləri göstərir.

Referans implementasiya: `packages/mocks/src/checks/` (TS, golden: `fixtures/scenarios/unec.expected.json`). Backend eyni nəticəni verməlidir — R-qaydalarında prototipin rolunu ümumi ailələrdə bu modul oynayır.

### 4. Çıxış: şablon + manifest + göndərmə
Təsdiqdən sonra ixrac (`POST /v1/packages/{id}/export`, status maşını dəyişmir):
1. Şablon yalnız `placeholders[]`-də xəritələnmiş yerlərdə doldurulur. Mənbə növləri: `field` (yalnız `max_count = 1` olan növün sahəsi — birmənalı), `aggregate` (`sum|count` — təsdiqlənmiş sənədlərin sahələrindən deterministik), `approval` (`approver_name|approved_on`), `package` (`reference`). Sərbəst mətn, AI izahı və ya istifadəçi daxil etməsi mənbə ola bilməz.
2. **Validasiya olunmuş sahə** = çıxarışda mənbə istinadı var, oxunmayan deyil və cari versiyanın bütün yoxlamaları keçib (təsdiq bunu tələb edir). Konfiqurasiya qaydası: `field` mənbəli hər placeholder aktiv `field_present` yoxlamasının hədəfində olmalıdır — tələb dəsti saxlananda yoxlanır.
3. İxrac zamanı hər hansı xəritələnmiş dəyər yoxdursa → ixrac rədd edilir: `422 VALIDATION_ERROR`, `details.missing_placeholders[]` (`placeholder, source`). Qismən doldurulmuş sənəd yaradılmır.
4. Zip: doldurulmuş şablon + seçilmiş cari sənəd versiyaları + `manifest.json` (paket, versiya, tələb dəsti versiyası, təsdiq, faylların `sha256`-sı, hər placeholder-in dəyəri və mənbə istinadı).
5. Göndərmə: zip yalnız tələb dəstindəki `submission.address`-ə gedir — ünvan sorğu body-sindən qəbul edilmir (məlumatın ixtiyari ünvana çıxmasının qarşısı). Göndərmə fon işidir (`jobs`); nəticə `ExportRecord.output.submission.status` (`QUEUED|SENT|FAILED`) və auditdə. Göndərmə xətası ixracı ləğv etmir; təkrar göndərmə eyni ixrac üçün idempotentdir. `EXPORTED` hələ də "göndərildi/qəbul edildi" demək deyil; `PAID` yoxdur.

### 5. AI provayderi — yalnız env ilə
```
AI_PROVIDER=mock|anthropic|openai   # default mock
AI_API_KEY=                          # mock-da tələb olunmur; yalnız serverdə
AI_MODEL=                            # provayderin model ID-si
AI_BASE_URL=                         # boşdursa provayderin default ünvanı (proxy / OpenAI-uyğun endpoint üçün)
```
- `LlmExtractor` protokolu: `extract(file, document_type) -> ExtractionResult`. Prompt = dəyişməz təhlükəsizlik prefiksi + reyestr növünün `instructions` + `extraction`-dan törənən JSON sxem. Çıxış həmin sxemlə və mənbə validasiyası ilə yoxlanır (ADR-0007 qaydaları qüvvədədir); uğursuzluq → `REVIEW_REQUIRED`, sahə `UNKNOWN`.
- Provayder dəyişmək yalnız env-dir; kod, reyestr və qaydalar dəyişmir. Provayder adapteri SDK-nı yalnız `extraction/providers/<ad>.py` daxilində import edir.
- PDF mətn qatı və CSV/XLSX oxunuşu provayder deyil, ön-emaldır: mətn qatı varsa LLM-ə mətn, yoxdursa şəkil göndərilir. Köhnə `AI_PROVIDER=pdf` keçid dövründə `mock`-dan sonra ilk addım kimi qəbul edilir və sonra silinir (backend step-i).
- Model ID-si, provayder və prompt versiyası audit metadata-sına yazılır; sənəd mətni log-a yazılmır.

## Müqavilə (0.4.0, pozucu deyil)
- `RequirementSet` + optional `documents`, `checks`, `output`; yeni sxemlər `DocumentRequirement`, `CheckConfig`, `FieldRef`, `OutputConfig`, `PlaceholderMapping`.
- `RuleId` pattern-i genişlənir; `CheckResult` + optional `check_type`.
- `ExportRecord` + optional `output` (şablon faylı, manifest, doldurulmuş dəyərlər, göndərmə statusu); export `422` təsviri `details.missing_placeholders`-i əhatə edir.
- **Yeni endpoint və xəta kodu bu dəyişiklikdə yoxdur.** `test_contract_drift.py` müqavilədəki əməliyyatların backend-də xidmət olunmasını, `test_error_codes_match_contract` isə `ErrorCode` bərabərliyini tələb edir. Planlaşdırılan `GET /v1/document-types`, `GET /v1/check-library`, `POST /v1/customers/{id}/output-templates` (multipart `.docx`) və tələb dəsti POST-una yeni sahələr backend step-i ilə eyni PR-da gəlir.

## Nəticələr
- Yeni müştəri dəsti = reyestr qeydi + tələb dəsti; kod yalnız yeni kitabxana ailəsi lazım olanda yazılır.
- Paket hələ də bir müştəriyə və bir valyutaya bağlıdır; çoxvalyutalı dəst `values_equal(currency)` ilə `FAIL` verir, çevrilmir.
- Demo: `fixtures/scenarios/unec.json` — UNEC tələbə qrantı hesabatı (2 paket: biri keçir, biri `U-07` ilə `NEEDS_FIX`). UNEC hələ mock store-un müştəri siyahısına əlavə edilmir: paket siyahısı/detal ekranları faktura formalıdır; ümumi paket axını backend + UI step-ləri ilə gəlir.
- Risk: konfiqurasiya səhvi (səhv parametr) səhv nəticə verə bilər → tələb dəsti saxlananda parametrlər kitabxana sxemi ilə yoxlanır, dəyişiklik approver təsdiqi və səbəb tələb edir (mövcud axın), hər dəyişiklik paket versiyasını artırır (ADR-0009).
