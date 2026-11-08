# Məlumat modeli (PostgreSQL)

Ümumi qaydalar:
- Hər biznes cədvəlində `company_id` (FK, NOT NULL, index). Repository-lər tenant filtrini **avtomatik** tətbiq edir; `company_id` heç vaxt request body-dən götürülmür — sessiyadakı üzvlükdən gəlir.
- PK: `uuid` (UUIDv7 tövsiyə olunur — sıralana bilən). İnsan oxuyan nömrələr (`INV-1042`, `T-124`) ayrıca sütundadır.
- `created_at`, `updated_at` (timestamptz). Silinmə yoxdur — audit tələbi; yalnız `PROCESSING/NEEDS_*` və heç vaxt təsdiqlənməmiş paket silinə bilər (soft delete: `deleted_at`).
- Pul: `NUMERIC(18,2)` + `currency CHAR(3)`. Miqdar: `NUMERIC(18,3)`.
- Enum-lar Postgres `TEXT` + `CHECK` (miqrasiya rahatlığı üçün native enum yox).

## Cədvəllər
| Cədvəl | Əsas sütunlar | Qeyd |
|---|---|---|
| `companies` | id, name, voen, locale | Tenant |
| `users` | id, email, full_name, title | |
| `memberships` | user_id, company_id, role, active | Unikal (user, company) |
| `customers` | id, company_id, name, external_id, voen | |
| `requirement_sets` | id, customer_id, version, require_po, require_delivery, require_signature, tolerance, effective_from, approved_by, reason | Unikal (customer, version); dəyişməz |
| `orders` | id, company_id, customer_id, po_number, currency, order_date | Unikal (company, po_number) |
| `order_lines` | order_id, product_code, description, qty, unit, unit_price | |
| `invoice_packages` | id, company_id, customer_id, invoice_number, currency, invoice_date, owner_id, version, order_id NULL, link_method (`exact_id`/`human`), link_confirmed_by, signature_reviewed_by, processing, problem_since, deleted_at | Unikal (company, customer, invoice_number) |
| `documents` | id, package_id, type (`invoice`/`order`/`delivery`) | |
| `document_versions` | id, document_id, version_no, file_name, storage_key, sha256, mime, size, pages, status, uploaded_by, package_version_at_upload | Unikal (document, version_no); dublikat yoxlaması `sha256` ilə paket daxilində |
| `extracted_invoices` | document_version_id, po_ref, po_raw, total, currency | Faktura versiyasının strukturlaşdırılmış nəticəsi |
| `extracted_invoice_lines` | extracted_invoice_id, product_code, qty, unit, unit_price | |
| `delivery_notes` | document_version_id, note_number, po_ref, customer_id, signed, delivery_date | |
| `delivery_note_lines` | delivery_note_id, product_code, qty | |
| `extracted_fields` | id, document_version_id, field_path, raw_value, normalized_value, review_status, corrected_by, correction_reason | Əl ilə düzəliş buradan, audit ilə |
| `evidence_refs` | id, document_version_id, field_path, page, quote, bbox JSONB NULL | Mənbə yoxdursa sahə etibarlı sayılmır |
| `validation_runs` | id, package_id, package_version, requirement_set_id, engine_version, created_at | |
| `check_results` | id, validation_run_id, rule_id, outcome, cascade, message, data JSONB, evidence_ids | |
| `resolution_tasks` | id, company_id, number, package_id, rule_id, assignee_id, step, due_date, status, comment, resolved_at | |
| `approval_records` | id, package_id, package_version, validation_run_id, requirement_set_id, approver_id, valid, invalidated_reason, created_at | Unikal (package, package_version) WHERE valid |
| `export_records` | id, package_id, package_version, approval_id, files JSONB, manifest_key, created_by | Unikal (package, package_version) |
| `audit_events` | id, company_id, actor_id NULL(system), action, object_type, object_id, package_version, detail JSONB, correlation_id, created_at | **Append-only**: UPDATE/DELETE trigger ilə qadağan |
| `jobs` | id, company_id, kind, payload JSONB, status, attempts, max_attempts, error_code, run_after, locked_at | Worker növbəsi |
| `notifications` | id, company_id, user_id, package_id, text, read_at | |
| `idempotency_keys` | key, company_id, endpoint, response JSONB, created_at | Approve/export/upload üçün |

## Versiya modeli
`invoice_packages.version` artır: yeni sənəd versiyası, kritik sahə düzəlişi, sifariş əlaqəsinin dəyişməsi. Qayda dəsti dəyişəndə versiya artmır, amma `requirement_set_id` fərqli olduğu üçün təsdiq etibarsız sayılır. Bütün dəyişikliklər `expected_version` ilə optimistic locking istifadə edir.

## Status saxlanmır
Paket statusu son `validation_run` + `approval_records` + `export_records`-dan **törədilir** (rules-engine.md). Siyahı sorğuları üçün `invoice_packages.cached_status` sütunu ola bilər, amma yalnız servis tərəfindən yenilənir və həqiqət mənbəyi deyil.
