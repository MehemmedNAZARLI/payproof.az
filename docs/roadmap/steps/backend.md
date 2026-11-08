# Backend track (B) — `apps/api`

**Sahib:** lead · **Stack:** Python 3.12, uv, FastAPI, Pydantic v2, SQLAlchemy 2 (async, asyncpg), Alembic, PostgreSQL 16, MinIO/S3 (boto3/aioboto3), PyMuPDF, pytest.
Oxu: `apps/api/CLAUDE.md`, `docs/architecture/*` (xüsusən `rules-engine.md`, `data-model.md`, `api-contract.md`, `security.md`).
Hər endpoint `packages/contracts/openapi.yaml`-a uyğun olmalıdır; uyğunsuzluq tapsan — `/contract-change`.
Ümumi skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `code-review`.

---

### B-01 · FastAPI skeleti
**Branch:** `feat/B-01-api-skeleton` · **Asılılıq:** S-08
**Daxildir:** `uv init` (src layout: `src/payproof/`), `pyproject.toml` (ruff, mypy strict, pytest config), qovluqlar `api, services, domain, repositories, schemas, extraction, storage, worker, core`; `core/settings.py` (pydantic-settings, `.env`), `core/logging.py` (JSON log, correlation id middleware), `core/errors.py` (DomainError → standart xəta formatı), `GET /v1/health`; `uv run payproof-api` script.
**Qəbul:** [ ] `uv run pytest` (health testi) yaşıl [ ] `ruff`, `mypy --strict` təmiz [ ] xəta formatı api-contract.md-dəki kimi
**Commit-lər:** 1) uv layihə + tooling 2) settings + logging 3) errors + handler + test 4) app factory + health

### B-02 · DB təməli
**Branch:** `feat/B-02-db-foundation` · **Asılılıq:** B-01
**Daxildir:** async engine/session, `Base` + mixin-lər (`IdMixin` uuid7, `TimestampMixin`, `TenantMixin`), Alembic (async env), `BaseRepository` (tenant filtri məcburi), pytest fixture-ləri (test DB, tranzaksiya rollback), `make migrate`.
**Qəbul:** [ ] boş miqrasiya işləyir [ ] tenant filtri olmadan sorğu yazmaq mümkün deyil (test) 
**Commit-lər:** 1) engine/session 2) base + mixins 3) alembic 4) BaseRepository + test 5) test fixtures

### B-03 · Kimlik və müştəri modelləri
**Branch:** `feat/B-03-identity-models` · **Asılılıq:** B-02
**Daxildir:** `companies, users, memberships, customers, requirement_sets` (data-model.md), miqrasiya, repository-lər, unikal məhdudiyyətlər.
**Qəbul:** [ ] miqrasiya up/down [ ] repository testləri (tenant izolyasiyası daxil)

### B-04 · Paket və sənəd modelləri
**Branch:** `feat/B-04-package-models` · **Asılılıq:** B-03
**Daxildir:** `orders, order_lines, invoice_packages, documents, document_versions, extracted_invoices(+lines), delivery_notes(+lines), extracted_fields, evidence_refs, validation_runs, check_results`, miqrasiya(lar) — bir neçə commit-ə bölün.
**Qəbul:** [ ] miqrasiyalar up/down [ ] FK və unikal məhdudiyyətlər testlə

### B-05 · Tapşırıq, təsdiq, ixrac, audit, bildiriş, job modelləri
**Branch:** `feat/B-05-workflow-models` · **Asılılıq:** B-04
**Daxildir:** `resolution_tasks, approval_records, export_records, audit_events` (+ UPDATE/DELETE-i qadağan edən trigger), `notifications, jobs, idempotency_keys`.
**Qəbul:** [ ] audit_events-də UPDATE/DELETE xəta verir (test) [ ] partial unique index: bir versiyaya bir qüvvədə təsdiq

### B-06 · Domen primitivləri
**Branch:** `feat/B-06-domain-primitives` · **Asılılıq:** B-01 · **Skills:** TDD
**Daxildir:** `domain/money.py` (`Money`, valyuta dəqiqliyi, qarışıq valyuta xətası), `domain/enums.py` (PackageStatus, CheckOutcome, TaskStatus, DocumentStatus, Role), `domain/permissions.py` (matris — security.md), `domain/snapshot.py` (`PackageSnapshot` və alt dataclass-lar — rules-engine.md).
**Qəbul:** [ ] `Money("0.1")+Money("0.2") == Money("0.3")` [ ] AZN+USD → xəta [ ] permission matrisi testlə
**Daxil deyil:** qaydalar.

### B-07 · Qayda mühərriki I — R-001…R-004
**Branch:** `feat/B-07-rules-engine-1` · **Asılılıq:** B-06, S-03 · **Skills:** TDD
**Daxildir:** `domain/rules/` — hər qayda ayrıca modul/funksiya, `CheckResult`, mesajlar (Azərbaycan dilində, prototiplə eyni), `evidence` placeholder-ləri (snapshot-dakı evidence ref-lərdən).
**Qəbul:** [ ] rules-engine.md cədvəlindəki hər budaq üçün test [ ] cascade bayrağı düzgün
**Commit-lər:** hər qayda üçün `test(...)` + `feat(...)` cütü

### B-08 · Qayda mühərriki II — R-005…R-009, status törədilməsi, golden test
**Branch:** `feat/B-08-rules-engine-2` · **Asılılıq:** B-07 · **Skills:** TDD
**Daxildir:** R-005 (fərq hesablaması `data.line_difference`), R-006 (sifariş + təhvil), R-007, R-008 (R-007-dən asılı), R-009 (tolerans), `evaluate()`, `derive_status()` (approval/export məlumatı ilə), `tests/golden/` — fixtures-dan snapshot quran helper + 14 paketin `expected.json`-a uyğunluğu + INV-1042 axını addımları.
**Qəbul:** [ ] golden test 14/14 [ ] R-005 INV-1044 üçün `500.00` [ ] `UNKNOWN` heç vaxt `READY_FOR_APPROVAL` vermir

### B-09 · Seed əmri
**Branch:** `feat/B-09-seed` · **Asılılıq:** B-05, S-03
**Daxildir:** `uv run payproof-seed [--reset]` — fixtures → DB (bir tranzaksiya, idempotent), fayl nümunələri üçün storage-a placeholder PDF-lər (B-13-dən sonra real), `make seed`.
**Qəbul:** [ ] iki dəfə işlədəndə dublikat yoxdur [ ] say yoxlaması testlə

### B-10 · Auth, tenant, səlahiyyət
**Branch:** `feat/B-10-auth` · **Asılılıq:** B-09 · **Skills:** `security-and-hardening`
**Daxildir:** `auth/verifier.py` (dev: HS256 lokal açar; interfeys JWKS üçün hazır), `POST /v1/auth/dev-login` (yalnız `ENV=dev`), `GET /v1/me` (rol + səlahiyyət siyahısı), `current_member` dependency, `require(Permission)` dependency, tenant konteksti repository-lərə ötürülür.
**Qəbul:** [ ] tokensiz → 401 [ ] readonly yazma → 403 [ ] başqa tenant obyekti → 404 [ ] prod-da dev-login yoxdur

### B-11 · Oxuma API-ləri
**Branch:** `feat/B-11-read-api` · **Asılılıq:** B-10, B-08
**Daxildir:** `services/package_query.py` (snapshot qurmaq, qaydaları işlətmək, status törətmək), `GET /v1/packages` (filtr: status, customer_id, owner_id, issue, period, q; sort; cursor), `GET /v1/packages/{id}` (api-contract.md forması: documents, comparison, checks, summary, tasks, permissions), `GET /v1/dashboard` (statuslar, valyuta üzrə açıq məbləğ — hər paket bir dəfə, ən çox təkrarlanan problem kateqoriyası, yaş, qayda üzrə FAIL/UNKNOWN sayları — cascade sayılmır, son təsdiqlər).
**Qəbul:** [ ] dashboard dəyərləri `expected.json`-a uyğun (29.706,00 AZN / 1.800,00 USD / 3,0 gün) [ ] N+1 sorğu yoxdur (sorğu sayı testi) [ ] cavablar openapi sxeminə uyğun

### B-12 · Audit servisi
**Branch:** `feat/B-12-audit` · **Asılılıq:** B-10
**Daxildir:** `services/audit.py` (`record(actor, action, object, package_version, detail)`, correlation id), `GET /v1/packages/{id}/audit`, `GET /v1/audit` (filtr, `?format=csv` — UTF-8 BOM).
**Qəbul:** [ ] hər yazma servisi audit çağırır (sonrakı step-lərdə yoxlanır) [ ] CSV Excel-də düzgün açılır

### B-13 · Storage və yükləmə
**Branch:** `feat/B-13-upload` · **Asılılıq:** B-12 · **Skills:** `security-and-hardening`
**Daxildir:** `storage/s3.py`, `POST /v1/packages/{id}/documents`, `POST /v1/documents/{id}/versions` (multipart, `Idempotency-Key`, `expected_version`), magic-bytes MIME yoxlaması, ölçü/səhifə limiti, sha256 dublikat (`409 DUPLICATE_FILE` + mövcud versiya məlumatı, audit "Təkrar fayl aşkarlandı"), versiya artımı + təsdiqin etibarsızlaşması, job yaratmaq (B-14 hazır deyilsə sinxron stub), `GET /v1/documents/versions/{id}/file` (5 dəq imzalı link).
**Qəbul:** [ ] dublikat yeni versiya yaratmır [ ] `.exe`-ni `.pdf` adlandırmaq rədd olunur [ ] köhnə versiya saxlanılır

### B-14 · Job növbəsi və worker
**Branch:** `feat/B-14-jobs` · **Asılılıq:** B-13
**Daxildir:** `worker/queue.py` (`JobQueue` interfeysi + Postgres impl, SKIP LOCKED), `uv run payproof-worker`, retry (3, backoff), `GET /v1/jobs/{id}`, sənəd statusu keçidləri (`UPLOADED→PROCESSING→EXTRACTED|REVIEW_REQUIRED|FAILED`).
**Qəbul:** [ ] iki worker eyni job-u götürmür (test) [ ] uğursuz job `FAILED`, biznes nəticəsi `PASS` olmur

### B-15 · Çıxarış pipeline-ı
**Branch:** `feat/B-15-extraction` · **Asılılıq:** B-14 · **Skills:** ADR-0007
**Daxildir:** `extraction/base.py` (protokol, `ExtractionResult`), `MockExtractionAdapter` (fayl adına görə `fixtures/samples.json`-dan əvvəlcədən hazırlanmış nəticə; nəticədə `source="mock"`), `PdfTextAdapter` (PyMuPDF mətn qatı + sadə sahə parser-i, CSV/XLSX), nəticənin sxem + mənbə validasiyası (mövcud olmayan səhifə → rədd), `extracted_*` və `evidence_refs` persist, sonra validation-u tetikləmək.
**Qəbul:** [ ] `INV-1042_v2_PO-381.pdf` yüklənəndə R-001 PASS olur [ ] skan (`INV-1047`) → `REVIEW_REQUIRED`, PO `UNKNOWN`

### B-16 · Sifariş uyğunlaşdırması
**Branch:** `feat/B-16-matching` · **Asılılıq:** B-15
**Daxildir:** `services/matching.py` — namizəd seçimi (prioritet: dəqiq PO ID → müştəri + məhsul kodları + miqdar; semantik oxşarlıq yalnız səbəb mətni üçün), `GET /v1/packages/{id}/match-candidates`, `POST /v1/packages/{id}/matches` (`expected_version`, versiya artımı, audit, revalidation); dəqiq ID varsa avtomatik `link_method=exact_id`.
**Qəbul:** [ ] INV-1048 → 2 namizəd, avtomatik seçim yoxdur [ ] INV-1042 link → `NEEDS_FIX`, v2

### B-17 · Validation run, imza yoxlaması
**Branch:** `feat/B-17-validation` · **Asılılıq:** B-16
**Daxildir:** `services/validation.py` — snapshot → engine → `validation_runs`/`check_results` persist, status keşi, `problem_since`, tapşırıqların avtomatik bağlanması/qaytarılması (rules-engine.md), `READY_FOR_APPROVAL`-a keçəndə təsdiqçilərə bildiriş; `POST /v1/packages/{id}/validate`, `POST /v1/packages/{id}/signature-review`.
**Qəbul:** [ ] INV-1042 axını addım 1–5 `expected.json`-a uyğun (inteqrasiya testi) [ ] tapşırıq yalnız qayda keçəndə `RESOLVED`

### B-18 · Çıxarış düzəlişi
**Branch:** `feat/B-18-field-correction` · **Asılılıq:** B-17
**Daxildir:** `PATCH /v1/fields/{id}` (dəyər validasiyası — PO formatı, müsbət miqdar, pul; səbəb ≥5 simvol məcburi; köhnə/yeni dəyər, istifadəçi, səbəb audit-ə; "sənədin özü dəyişmədi"), versiya artımı, revalidation.
**Qəbul:** [ ] INV-1047 PO düzəlişi → `READY_FOR_APPROVAL` [ ] səbəbsiz → 422

### B-19 · Tapşırıqlar API
**Branch:** `feat/B-19-tasks` · **Asılılıq:** B-17
**Daxildir:** `POST /v1/packages/{id}/tasks` (rule_id FAIL/UNKNOWN olmalıdır; bir qayda üçün bir açıq tapşırıq), `PATCH /v1/tasks/{id}` (`OPEN→IN_PROGRESS→SUBMITTED_FOR_RECHECK`; `RESOLVED` göndərmək → 422; submit → dərhal revalidation), `DELETE` (ləğv, audit), `GET /v1/tasks` (filtr: status, assignee), nömrələmə `T-124…`, məsul şəxsə bildiriş.
**Qəbul:** [ ] keçid matrisi testlə [ ] son tarix keçmişdə ola bilməz

### B-20 · Təsdiq
**Branch:** `feat/B-20-approval` · **Asılılıq:** B-19 · **Skills:** `security-and-hardening`
**Daxildir:** `POST /v1/packages/{id}/approve` (`expected_version`, `Idempotency-Key`), state-machines.md cədvəli (403/409/200-idempotent), `approval_records` (validation_run + requirement_set ilə), versiya artanda və qayda dəyişəndə etibarsızlaşma (audit + bildiriş), sahibinə bildiriş.
**Qəbul:** [ ] operator → 403 [ ] bloklanmış → 409 [ ] köhnə versiya → 409 [ ] təkrar → eyni cavab, yeni audit yox [ ] paralel iki sorğu → bir təsdiq

### B-21 · İxrac və daxili hesabat
**Branch:** `feat/B-21-export` · **Asılılıq:** B-20
**Daxildir:** `POST /v1/packages/{id}/export` (seçilmiş sənəd versiyaları; faktura məcburi; manifest JSON + zip storage-a; imzalı link qaytarılır; idempotent), `GET /v1/packages/{id}/internal-report` (yoxlamalar + mənbələr + audit — xarici paketə daxil deyil).
**Qəbul:** [ ] manifestdə yalnız seçilmiş fayllar [ ] AI izahı/şərh/audit xarici paketdə yoxdur [ ] təkrar ixrac → yeni hadisə yox

### B-22 · Müştəri qaydaları API
**Branch:** `feat/B-22-requirements` · **Asılılıq:** B-20
**Daxildir:** `GET /v1/customers`, `GET/POST /v1/customers/{id}/requirements` (yalnız approver; səbəb ≥10; tolerans ≤ 1.00; dəyişiklik yoxdursa 422), yeni versiyadan sonra müştərinin ixrac edilməmiş paketlərinin revalidation-u + köhnə təsdiqlərin etibarsızlaşması.
**Qəbul:** [ ] c2-yə imza tələbi əlavə edəndə INV-1035 `NEEDS_REVIEW` olur

### B-23 · Bildirişlər API
**Branch:** `feat/B-23-notifications` · **Asılılıq:** B-17
**Daxildir:** `services/notifications.py` (hadisə → alıcılar), `GET /v1/notifications`, `POST /{id}/read`, `POST /read-all`; fixtures-dakı bildirişlər seed-də.
**Qəbul:** [ ] başqa istifadəçinin bildirişi görünmür

### B-24 · Yeni paket və silmə
**Branch:** `feat/B-24-create-package` · **Asılılıq:** B-21
**Daxildir:** `POST /v1/packages` (müştəri, faktura nömrəsi, sənədlər → job-lar; `409 DUPLICATE_INVOICE`), emal bitəndə dəqiq PO ilə avtomatik əlaqə, `DELETE /v1/packages/{id}` (yalnız heç vaxt təsdiqlənməmiş; soft delete; audit qalır).
**Qəbul:** [ ] `INV-1051` → `READY_FOR_APPROVAL`, `INV-1052` → `NEEDS_FIX` [ ] təsdiqlənmiş paket silinmir

### B-25 · Real çıxarış (stretch)
**Branch:** `feat/B-25-ocr-llm` · **Asılılıq:** B-15 · **Skills:** `claude-api` (LLM provayderi Claude seçilərsə), `security-and-hardening`
**Daxildir:** `OcrAdapter` (Tesseract `aze+eng`), `LlmAdapter` (strukturlaşdırılmış JSON çıxışı, provayder `AI_PROVIDER`, prompt security.md-dəki kimi, timeout + retry, model/prompt versiyası audit metadata-da), prompt-injection testi, AI əlçatmaz olanda `UNKNOWN` + manual daxil etmə.
**Qəbul:** [ ] açar yoxdursa mock-a düşür və UI-də bu görünür [ ] injection mətni nəticəni dəyişmir [ ] əminlik faizi göstərilmir

### B-26 · Möhkəmləndirmə və müqavilə testi
**Branch:** `feat/B-26-hardening` · **Asılılıq:** B-24 · **Skills:** `security-and-hardening`, `security-review`
**Daxildir:** FastAPI sxemi ↔ `openapi.yaml` drift testi (CI-da), hər yazma endpoint-i üçün tenant testi, sadə rate limit (upload, login), log-larda sənəd mətni olmadığını yoxlayan test, `security-review` nəticələrinin düzəldilməsi.
**Qəbul:** [ ] drift testi CI-da [ ] security review-da kritik tapıntı yoxdur
