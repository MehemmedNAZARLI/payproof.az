# Demo dataset (sintetik)

Mənbə: prototipdəki JS sabitləri — `docs/product/prototype/payproof-prototype.html` faylında `ORDERS`, `PKGS`, `TASKS`, `SAMPLES`, `NEWSETS`, `USERS`, `PRODUCTS` və `reset()` funksiyasındakı `customers`. Gözlənilən statuslar `selfTest()` funksiyasındadır. S-03 step-i bunları `fixtures/*.json`-a köçürür; backend seed, frontend mock-lar və qayda testləri **eyni fixtures**-dan istifadə edir.

## Ümumi
- Satıcı (tenant): **A Distribusiya MMC**, VÖEN 1700123451
- "Bu gün": `2026-11-08T10:30` (demo saatı sabitdir)
- Müştərilər:
  - `c1` **B Mağazalar Şəbəkəsi** — qayda dəsti v1 (PO, təhvil), **v2 (PO, təhvil, imza)** — qüvvədə 01.10.2026-dan
  - `c2` **C Restoran Qrupu** — v1 (PO, təhvil, imza yox)
  - Yuvarlaqlaşdırma toleransı: 0,01
- İstifadəçilər: Aygün Məmmədova (operator), Səbinə Quliyeva (operator), Rəşad Əliyev (approver), Kamran Babayev (readonly), Leyla Rzayeva (mühasibat), Elvin Qasımov (anbar), Nigar Hüseynova (satış)
- 18 sifariş, 10 məhsul, 9 tapşırıq (6 açıq, 3 həll edilib)

## Paketlər və gözlənilən nəticə (ilkin vəziyyət)
| Paket | Müştəri | Məbləğ | Status | Əsas bloklayan | Ssenari |
|---|---|---|---|---|---|
| INV-1042 | c1 | 12.000,00 AZN | NEEDS_REVIEW | R-001 FAIL, R-002 UNKNOWN, R-007 FAIL | **Əsas demo**: PO yoxdur, PO-381 namizəd, təhvil aktı yoxdur |
| INV-1038 | c1 | 4.860,00 AZN | READY_FOR_APPROVAL | — | Tam uyğun |
| INV-1036 | c1 | 6.200,00 AZN | READY_FOR_APPROVAL | — | v3; v2 təsdiqi etibarsızlaşıb |
| INV-1043 | c1 | 1.920,00 AZN | NEEDS_FIX | R-002 FAIL | Fakturada PO-328, sifariş PO-382 |
| INV-1044 | c1 | 6.900,00 AZN | NEEDS_FIX | R-005 FAIL (fərq 500,00) | KY-10: 110,00 vs 100,00 × 50 |
| INV-1045 | c2 | 2.484,00 AZN | NEEDS_FIX | R-006 FAIL | MS-05: fakturada 120, aktda 100 |
| INV-1046 | c1 | 1.800,00 AZN | NEEDS_FIX | R-003 FAIL, R-007 UNKNOWN | Akt başqa müştəriyə aiddir |
| INV-1047 | c2 | 2.730,00 AZN | NEEDS_REVIEW | R-001 UNKNOWN | Skanda PO oxunmadı (`PO-3?7`) |
| INV-1048 | c1 | 1.872,00 AZN | NEEDS_REVIEW | R-001 FAIL, R-002 UNKNOWN | İki namizəd: PO-383, PO-384 |
| INV-1049 | c2 | 1.800,00 USD | NEEDS_REVIEW | R-004 UNKNOWN | Faktura USD, sifariş AZN |
| INV-1050 | c2 | 900,00 USD | PROCESSING | — | Emal gedir |
| INV-1035 | c2 | 3.100,00 AZN | APPROVED_READY | — | Təsdiqlənib, ixrac gözləyir |
| INV-1033 | c1 | 4.500,00 AZN | EXPORTED | — | |
| INV-1031 | c2 | 3.240,00 AZN | EXPORTED | — | |

Dashboard yoxlaması: açıq problemli məbləğ **29.706,00 AZN** (7 paket) və **1.800,00 USD** (1 paket); orta problem müddəti **3,0 gün**, ən uzun INV-1042 — 5 gün.

## Əsas demo axını (INV-1042) — gözlənilən keçidlər
1. PO-381 əlaqəsi təsdiqlənir → `NEEDS_FIX` (bloklayan: R-001, R-007), paket v2
2. `INV-1042_v2_PO-381.pdf` yüklənir → R-001, R-002 PASS, v3
3. `INV-1042.pdf` təkrar yüklənir → dublikat, yeni versiya yoxdur
4. `TS-5531_imzali.pdf` yüklənir → R-007 PASS, R-008 UNKNOWN → `NEEDS_REVIEW`, v4
5. İmza yoxlanır → `READY_FOR_APPROVAL`; R-001/R-007 tapşırıqları avtomatik `RESOLVED`
6. Operator təsdiq edə bilmir (403); təsdiqçi təsdiqləyir → `APPROVED_READY`; təkrar təsdiq idempotent
7. İxrac → `EXPORTED`; təkrar ixrac yeni hadisə yaratmır

## Yeni paket dəstləri
- `INV-1051` (c2, PO-399, tam dəst) → `READY_FOR_APPROVAL`
- `INV-1052` (c1, PO-400, təhvil aktı yoxdur) → `NEEDS_FIX`
