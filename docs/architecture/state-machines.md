# Status maşınları

Sənəd, yoxlama, tapşırıq və paket statusları **ayrıdır** — bir `status` sütununda birləşdirilmir.

## Sənəd versiyası
```
UPLOADED → PROCESSING → EXTRACTED
                      → REVIEW_REQUIRED   (kritik sahə oxunmadı)
                      → FAILED            (texniki xəta; biznes FAIL deyil)
```

## Faktura paketi (törədilir)
```
PROCESSING → NEEDS_REVIEW ⇄ NEEDS_FIX → READY_FOR_APPROVAL → APPROVED_READY → EXPORTED
                 ▲                              │                  │              │
                 └──────── yeni versiya / qayda dəyişikliyi ───────┴──────────────┘
```
- Yeni versiya və ya qayda dəyişikliyi istənilən statusdan paketi yenidən yoxlamaya qaytarır; cari təsdiq `valid=false` olur.
- `EXPORTED` = həmin versiyanın paketi yüklənib. Göndərildi/qəbul edildi demək deyil. `PAID` yoxdur.

## Tapşırıq
```
OPEN ──(icraya götür)──► IN_PROGRESS ──(yoxlamaya göndər)──► SUBMITTED_FOR_RECHECK
  │                          ▲                                      │
  │                          └────── qayda hələ keçmir (sistem) ────┤
  └──────── qayda keçdi (sistem, istənilən açıq statusdan) ─────────┴──► RESOLVED
```
- `RESOLVED`-u yalnız sistem qoyur. İstifadəçi `PATCH` ilə `RESOLVED` göndərə bilməz → `422`.
- Ləğv: tapşırıq silinir (soft), audit qeydi yazılır; yoxlama nəticəsi dəyişmir.

## Təsdiq qaydaları
| Şərt | Nəticə |
|---|---|
| İstifadəçi rolu `approver` deyil | 403 |
| Status `READY_FOR_APPROVAL` deyil | 409 `PACKAGE_NOT_READY` |
| `expected_version` cari versiya deyil | 409 `VERSION_CONFLICT` |
| Eyni versiya artıq təsdiqlənib | 200, mövcud təsdiq qaytarılır (yeni audit yoxdur) |
| `expected_requirement_set_version` cari qayda dəsti deyil | 409 `VERSION_CONFLICT` (istifadəçi görmədiyi qayda versiyasını təsdiqləyə bilməz) |

Yoxlama ardıcıllığı: 403 → 409 `VERSION_CONFLICT` → (cari versiya + cari qayda dəsti üçün etibarlı təsdiq varsa) 200 mövcud → 409 `PACKAGE_NOT_READY` → 200 yeni. Təkrar sorğu `Idempotency-Key`-dən asılı olmayaraq eyni cavabı alır.

## İxrac qaydaları
| Şərt | Nəticə |
|---|---|
| Status `APPROVED_READY` deyil və cari versiya ixrac edilməyib | 409 |
| Cari versiya artıq ixrac edilib | 200, mövcud ixrac qaytarılır (yeni audit yoxdur) |
| Faktura seçilməyib | 422 (faktura məcburidir) |

Yoxlama ardıcıllığı: 403 → 409 `VERSION_CONFLICT` → (cari versiya ixrac edilibsə) 200 mövcud → 409 `PACKAGE_NOT_READY` → 422 `INVOICE_REQUIRED` → 200 yeni.
