# Lüğət: domen terminləri ↔ kod adları

Kodda adlar **ingiliscə**, UI mətnləri **Azərbaycan dilində**. UI mətnləri `packages/api-client/src/i18n/az.ts`-dən gəlir (S-05).

## Obyektlər
| Kod | UI (az) | Qeyd |
|---|---|---|
| `Company` | Şirkət | Tenant. Bütün məlumat `company_id`-yə bağlıdır |
| `User`, `Membership` | İstifadəçi, üzvlük | Rol üzvlükdədir |
| `Customer` | Müştəri | Fakturanın alıcısı |
| `RequirementSet` | Qayda dəsti (v1, v2…) | Müştərinin məcburi tələbləri, versiyalı |
| `InvoicePackage` | Faktura paketi | Bir faktura + bir sifariş + təhvil sənədi(ləri) |
| `Document` / `DocumentVersion` | Sənəd / sənəd versiyası | `invoice`, `order`, `delivery` |
| `ExtractedField`, `EvidenceRef` | Çıxarılmış sahə, mənbə istinadı | Sənəd versiyası + səhifə + sitat/bbox |
| `Order` | Sifariş (PO) | |
| `DeliveryNote` | Təhvil sənədi / təhvil-təslim aktı | |
| `ValidationRun`, `CheckResult` | Yoxlama, yoxlama nəticəsi | |
| `ResolutionTask` | Tapşırıq | |
| `ApprovalRecord` | Təsdiq | Paket versiyasına bağlıdır |
| `ExportRecord` | İxrac | |
| `AuditEvent` | Audit hadisəsi | Append-only |
| `Notification` | Bildiriş | Tətbiq daxili |

## Rollar
| Kod | UI | 
|---|---|
| `operator` | Operator |
| `approver` | Təsdiqçi |
| `readonly` | Yalnız baxış |
| `admin` | Admin (P0-da UI yoxdur) |
| `assignee` | Tapşırıq icraçısı |

`assignee` (ADR-0008) — anbar, satış, mühasibatlıq əməkdaşları: tapşırıq alır, sistemə daxil olmur, icazəsi yoxdur. Onların sənədini operator yükləyir. P1-də `contributor` rolu mümkündür.

## Statuslar
**Paket** (`PackageStatus`)
| Kod | UI | Badge |
|---|---|---|
| `PROCESSING` | Emal olunur | info |
| `NEEDS_REVIEW` | Yoxlama tələb edir | warning |
| `NEEDS_FIX` | Düzəliş tələb edir | danger |
| `READY_FOR_APPROVAL` | Təsdiq gözləyir | brand |
| `APPROVED_READY` | Göndərilməyə hazır | success |
| `EXPORTED` | İxrac edilib | neutral |

**Yoxlama** (`CheckOutcome`): `PASS` Keçdi · `FAIL` Uyğunsuz · `UNKNOWN` Naməlum · `NOT_APPLICABLE` Tətbiq olunmur

**Tapşırıq** (`TaskStatus`): `OPEN` Açıq · `IN_PROGRESS` İcrada · `SUBMITTED_FOR_RECHECK` Yenidən yoxlamada · `RESOLVED` Həll edilib

**Sənəd versiyası** (`DocumentStatus`): `UPLOADED` Yükləndi · `PROCESSING` Emal olunur · `EXTRACTED` Çıxarıldı · `REVIEW_REQUIRED` Sahə oxunmadı · `FAILED` Emal xətası

## Qaydalar
| ID | Ad (UI) | Qısa |
|---|---|---|
| R-001 | Məcburi sifariş nömrəsi (PO) | PO çatışmır |
| R-002 | PO təsdiqlənmiş sifarişə uyğundur | PO uyğunluğu |
| R-003 | Tərəflərin uyğunluğu | Tərəf fərqi |
| R-004 | Valyuta və vahid uyğunluğu | Valyuta / vahid |
| R-005 | Vahid qiymət uyğunluğu | Qiymət fərqi |
| R-006 | Miqdar uyğunluğu | Miqdar fərqi |
| R-007 | Məcburi təhvil sənədi | Təhvil sənədi |
| R-008 | İmza tələbi (insan yoxlaması) | İmza yoxlaması |
| R-009 | Cəmlərin arifmetik uyğunluğu | Cəm fərqi |
| R-010 | Ümumi hazırlıq | (status törədilir) |

## Format
- Pul: `12.000,00 AZN` (min ayırıcı nöqtə, onluq vergül). Mənfi: `−500,00`.
- Tarix: `03.11.2026`, tarix+vaxt: `03.11.2026, 09:12`, uzun: `8 noyabr 2026`.
- Qadağan ifadələr: "Ödəniş təmin edildi", "Faktura ödənildi", "Fraud aşkarlandı", "AI hər şeyi yoxladı", "Maliyyə itkisi".
