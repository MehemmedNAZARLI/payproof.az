# API müqaviləsi — konvensiyalar və endpoint-lər

Həqiqət mənbəyi: `packages/contracts/openapi.yaml` (S-04). Bu sənəd onun qaydalarını izah edir. Müqavilə dəyişikliyi yalnız `/contract-change` prosesi ilə.

## Konvensiyalar
- Prefiks `/v1`. JSON, `snake_case` sahələr. TS client-də də `snake_case` saxlanılır (çevirmə yoxdur — sadəlik).
- Auth: `Authorization: Bearer <JWT>`. Tenant JWT-dəki üzvlükdən; body-də `company_id` qəbul edilmir.
- Pul: `{"amount": "12000.00", "currency": "AZN"}` — **string**. Miqdar: string (`"800"`).
- Vaxt: ISO 8601 UTC (`2026-11-03T09:12:00Z`); tarix: `2026-11-03`.
- Siyahılar: cursor pagination — `?limit=50&cursor=…` → `{"items": [...], "next_cursor": null}`. Filtr və sıralama query parametrləri ilə (`status`, `customer_id`, `owner_id`, `issue`, `from`, `to`, `q`, `sort=-updated_at`).
- Versiyanı dəyişən sorğularda body-də `expected_version` → uyğun deyilsə `409 VERSION_CONFLICT`.
- Approve, export, upload: `Idempotency-Key` header-i (UUID). Təkrar sorğu əvvəlki cavabı qaytarır.
- Uzun iş: `202 Accepted` + `{"job_id": …}` → `GET /v1/jobs/{id}`.

## Xəta formatı
```json
{ "error": { "code": "VERSION_CONFLICT", "message": "Paket v3-ə yenilənib; səhifəni yeniləyin.", "details": {} } }
```
| HTTP | code nümunələri |
|---|---|
| 400/422 | `VALIDATION_ERROR` (400 — formatı yanlış body), `TASK_STATUS_NOT_ALLOWED`, `INVOICE_REQUIRED`, `IDEMPOTENCY_KEY_REUSED` (eyni açar, fərqli body) |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` (rol icazəsi yoxdur) |
| 404 | `NOT_FOUND` (başqa tenant-ın obyekti də 404 qaytarır, 403 yox) |
| 409 | `VERSION_CONFLICT`, `PACKAGE_NOT_READY`, `PACKAGE_NOT_DELETABLE`, `TASK_ALREADY_OPEN`, `DUPLICATE_FILE`, `DUPLICATE_INVOICE`, `IDEMPOTENCY_IN_PROGRESS` |
| 413/415 | `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE` |

`message` Azərbaycan dilindədir və UI-də göstərilə bilər.

## Endpoint-lər (P0)
| Metod və yol | Məqsəd | Rol | Step |
|---|---|---|---|
| `GET /v1/auth/dev-users` | Dev-login seçimi üçün demo istifadəçilər (yalnız `ENV=dev`) | — | B-10 |
| `POST /v1/auth/dev-login` | Demo istifadəçi üçün JWT (yalnız `ENV=dev`) | — | B-10 |
| `GET /v1/me` | Cari istifadəçi, rol, səlahiyyətlər | hamı | B-10 |
| `GET /v1/users` | Şirkət üzvləri (məsul / sahib / filtr seçimi; `?assignable=true`) | hamı | B-10 |
| `GET /v1/dashboard` | KPI-lər, valyuta üzrə məbləğ, problem növləri, yaş | hamı | B-11 |
| `GET /v1/packages` | Siyahı + filtr + sıralama | hamı | B-11 |
| `POST /v1/packages` | Yeni paket (sənəd dəsti ilə) | operator, approver | B-24 |
| `GET /v1/packages/{id}` | Detal: versiya, sənədlər, müqayisə, yoxlamalar, tapşırıqlar | hamı | B-11 |
| `DELETE /v1/packages/{id}` | Heç vaxt təsdiqlənməmiş paketi silmək | operator | B-24 |
| `POST /v1/packages/{id}/documents` | Sənəd yükləmək (multipart) → job | operator, approver | B-13 |
| `POST /v1/documents/{id}/versions` | Yeni sənəd versiyası → job | operator, approver | B-13 |
| `GET /v1/documents/versions/{id}/file` | Qısa ömürlü (5 dəq) imzalı link | hamı | B-13 |
| `GET /v1/jobs/{id}` | Emal vəziyyəti | hamı | B-14 |
| `GET /v1/packages/{id}/match-candidates` | Sifariş namizədləri + səbəb | hamı | B-16 |
| `POST /v1/packages/{id}/matches` | Sifariş əlaqəsini təsdiqləmək | operator, approver | B-16 |
| `PATCH /v1/fields/{id}` | Çıxarışı mənbəyə əsasən düzəltmək (səbəb məcburi) | operator, approver | B-18 |
| `POST /v1/packages/{id}/signature-review` | İmzanın vizual mövcudluğunu qeyd etmək | operator, approver | B-17 |
| `POST /v1/packages/{id}/validate` | Cari versiya üzrə yoxlama | operator, approver | B-17 |
| `GET /v1/tasks` · `POST /v1/packages/{id}/tasks` · `PATCH /v1/tasks/{id}` · `DELETE /v1/tasks/{id}` | Tapşırıqlar | yazmaq: operator, approver | B-19 |
| `POST /v1/packages/{id}/approve` | Cari versiyanı təsdiqləmək | **approver** | B-20 |
| `POST /v1/packages/{id}/export` | Seçilmiş sənədlərlə ixrac (manifest + zip) | operator, approver | B-21 |
| `GET /v1/packages/{id}/internal-report` | Daxili yoxlama hesabatı | hamı | B-21 |
| `GET /v1/exports/{id}/download` | Mövcud ixracın zip-i üçün yeni qısa ömürlü link | hamı | B-21 |
| `GET /v1/packages/{id}/audit` · `GET /v1/audit` (`?format=csv`) | Audit | hamı | B-12 |
| `GET /v1/customers` · `GET/POST /v1/customers/{id}/requirements` | Qayda dəstləri | yazmaq: **approver** | B-22 |
| `GET /v1/notifications` · `POST /v1/notifications/{id}/read` · `POST /v1/notifications/read-all` | Bildirişlər | hamı | B-23 |
| `POST /v1/demo/reset` | Demo məlumatı sıfırlamaq (yalnız `ENV=dev`) | — | I-02 |

## Paket detalı cavabının forması (qısa)
```json
{
  "id": "…", "invoice_number": "INV-1042", "version": 4, "status": "READY_FOR_APPROVAL",
  "customer": {"id": "…", "name": "B Mağazalar Şəbəkəsi"},
  "total": {"amount": "12000.00", "currency": "AZN"},
  "requirement_set": {"version": 2, "require_po": true, "require_delivery": true, "require_signature": true},
  "link": {"confirmed": true, "order_po": "PO-381", "method": "human", "candidates": []},
  "documents": [{"type": "invoice", "current": {"version_no": 2, "file_name": "…", "status": "EXTRACTED"}, "history": [...]}],
  "comparison": {"rows": [...]},
  "checks": [{"rule_id": "R-001", "outcome": "PASS", "cascade": false, "message": "…", "evidence": [{"document_version_id": "…", "page": 1, "quote": "…", "bbox": null}], "fix_hint": null}],
  "summary": {"pass": 9, "fail": 0, "unknown": 0, "not_applicable": 0, "blocking": []},
  "current_approval": {"approver": "…", "at": "…", "version": 4} ,
  "tasks": [...], "permissions": {"can_approve": false, "can_export": true, "can_edit": true}
}
```
`permissions` UI üçün ipucudur; server hər sorğuda yenidən yoxlayır.
