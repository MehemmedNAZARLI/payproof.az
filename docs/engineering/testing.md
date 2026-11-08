# Test strategiyası

Məqsəd yalnız xoş ssenari deyil — **yanlış "hazır" nəticəsinin qarşısını almaq**.

## Səviyyələr
| Səviyyə | Alət | Nəyi | Harada |
|---|---|---|---|
| Domen unit | pytest | Pul, qaydalar R-001…R-009, status törədilməsi, versiya, tapşırıq keçidləri | `apps/api/tests/domain/` |
| Golden | pytest | 14 fixture paketi → `fixtures/expected.json` statusları və bloklayanları | `apps/api/tests/golden/` |
| Servis/inteqrasiya | pytest + Postgres (docker) | Tranzaksiya, audit, versiya artımı, idempotentlik, tenant izolyasiyası | `apps/api/tests/integration/` |
| API | pytest + httpx | Status kodları, xəta formatı, səlahiyyət (403/404) | `apps/api/tests/api/` |
| Müqavilə | schemathesis və ya sxem diff | FastAPI sxemi ↔ `openapi.yaml` | B-26 |
| Frontend unit | Vitest + Testing Library | Komponentlər, hooks, format helper-ləri | `apps/*/src/**/*.test.tsx` |
| Mock mühərriki | Vitest | `packages/mocks` qaydaları `expected.json` ilə eyni nəticəni verir | `packages/mocks` |
| E2E | Playwright | INV-1042 əsas axını (veb), mobil təsdiq axını | `apps/web/e2e`, `apps/mobile/e2e` |

## Məcburi testlər (brif §22)
- Məcburi PO çatışmır → `FAIL`; oxunmayıb → `UNKNOWN`; `UNKNOWN` paketi bloklayır.
- Fərqli valyuta/vahid avtomatik müqayisə edilmir.
- Dashboard: təkrar yükləmə məbləği ikiqat artırmır; AZN və USD qarışmır.
- Başqa müştəriyə aid təhvil aktı uyğun sayılmır.
- Bir neçə PO namizədi → insan seçimi.
- Bloklanmış paket təsdiqlənmir; operator təsdiqləyə bilmir.
- Təsdiqdən sonra kritik dəyişiklik → yeni təsdiq lazımdır.
- Köhnə versiya üçün təsdiq → 409. Təkrar approve/export → yeni hadisə yoxdur.
- İxrac manifestinə yalnız seçilmiş sənədlər düşür.
- Başqa tenant-ın ID-si → 404.
- Sənəddəki prompt injection mətni nəticəni dəyişmir (B-25).
- Model/OCR xətası `PASS`-a çevrilmir.

## Qaydalar
- Domen dəyişikliyi = əvvəl qırmızı test (TDD).
- Test adı davranışı deyir: `test_missing_po_fails_when_customer_requires_po`.
- Fixtures yalnız `fixtures/`-dan; testlərdə "magic" data minimal.
- Flaky test — dərhal düzəlt və ya `skip` + issue; heç vaxt "sonra baxarıq".
- Coverage hədəfi: `domain/` ≥ 95%, `services/` ≥ 80%, frontend feature-lər ≥ 70%.
