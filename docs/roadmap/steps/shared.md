# Shared track (S) — Foundation

**Sahib:** lead · **Ardıcıl icra olunur** (S-01 → S-08). S-08 bitməmiş B/W/M başlamır.
Hər step: öz branch-ı, kiçik commit-lər (≤200 sətir), `/finish-step` ilə bitir.

---

### S-01 · Monorepo bootstrap
**Branch:** `feat/S-01-monorepo` · **Asılılıq:** — · **Skills:** `superpowers:writing-plans`
**Məqsəd:** pnpm workspace + Turborepo + kök alət konfiqurasiyası.
**Daxildir:**
- Kök `package.json` (`private`, `packageManager: pnpm@9`), `pnpm-workspace.yaml` (`apps/web`, `apps/mobile`, `packages/*`), `turbo.json` (lint, typecheck, test, build pipeline-ları)
- `.nvmrc` (22), `apps/api/.python-version` (3.12)
- Kök Prettier, `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`)
- `Makefile`: `setup, up, down, seed, test, lint, typecheck, dev-api, dev-web, dev-mobile` (hələ olmayan hədəflər aydın mesajla çıxır)
- `scripts/setup.sh`-in pnpm install-u işlətməsi
**Daxil deyil:** app-lərin özü (B-01, W-01, M-01), CI (S-08).
**Qəbul meyarları:**
- [ ] `pnpm install` təmiz işləyir, `pnpm turbo run lint` boş workspace-də xətasız
- [ ] `make help` bütün hədəfləri göstərir
- [ ] Git hook-ları aktivdir (`git config core.hooksPath` → `.githooks`)
**Commit planı:** 1) workspace + turbo 2) tsconfig/prettier 3) Makefile 4) setup script yeniləməsi

---

### S-02 · Lokal infrastruktur (Docker Compose)
**Branch:** `feat/S-02-infra` · **Asılılıq:** S-01
**Məqsəd:** PostgreSQL 16 və MinIO bir əmrlə.
**Daxildir:** `docker-compose.yml` (postgres 16 + healthcheck + volume `.data/pg`; minio + konsol + `payproof-docs` bucket-ini yaradan init konteyneri), `.env.example` uyğunlaşdırılması, `make up/down/logs/psql`.
**Daxil deyil:** api/worker konteynerləri (I-02).
**Qəbul meyarları:**
- [ ] `make up` → postgres `healthy`, MinIO konsolu açılır, bucket mövcuddur
- [ ] `.env.example`-dəki dəyərlərlə qoşulmaq olur
**Commit planı:** 1) compose postgres 2) minio + bucket init 3) Makefile hədəfləri + README bölməsi

---

### S-03 · Demo fixtures
**Branch:** `feat/S-03-fixtures` · **Asılılıq:** S-01 · **Skills:** `superpowers:test-driven-development`
**Məqsəd:** Prototipdəki sintetik dataset-i dil-neytral JSON-a köçürmək — backend seed, mock-lar və testlər eyni məlumatı istifadə etsin.
**Mənbə:** `docs/product/prototype/payproof-prototype.html` (`USERS`, `PRODUCTS`, `ORDERS`, `PKGS`, `TASKS`, `SAMPLES`, `NEWSETS`, `reset()`-dəki müştərilər/bildirişlər, `selfTest()`), `docs/product/demo-dataset.md`.
**Daxildir:**
- `fixtures/company.json, users.json, customers.json` (qayda dəstləri versiyaları ilə), `products.json, orders.json, packages.json` (sənəd versiyaları, çıxarılmış sahələr, `po_raw`, `unreadable`, təhvil aktları, təsdiq/ixrac tarixçəsi), `tasks.json, notifications.json, samples.json, newsets.json`
- `fixtures/expected.json`: hər paket üçün status, əsas bloklayan qaydalar, R-005 fərqi; dashboard dəyərləri (29.706,00 AZN / 1.800,00 USD); INV-1042 axınının addım-addım gözlənilən statusları
- `fixtures/schema/*.json` (JSON Schema) + `fixtures/validate.mjs` (ajv) + `pnpm fixtures:check`
- Pul dəyərləri string (`"9.00"`), tarixlər ISO
**Daxil deyil:** seed kodu (B-09), mock store (S-06).
**Qəbul meyarları:**
- [ ] 14 paket, 18 sifariş, 2 müştəri, 7 istifadəçi, 9 tapşırıq, 8 nümunə fayl, 2 yeni dəst
- [ ] `pnpm fixtures:check` keçir; `expected.json` `demo-dataset.md` ilə eynidir
**Commit planı:** 1) schemas 2) users/customers/products/orders 3) packages (2–3 commit-ə bölün) 4) tasks/notifications/samples/newsets 5) expected.json 6) validate script

---

### S-04 · API müqaviləsi v0 (OpenAPI 3.1)
**Branch:** `feat/S-04-openapi` · **Asılılıq:** S-03 · **Skills:** `api-and-interface-design`
**Məqsəd:** Bütün P0 endpoint-lərinin müqaviləsi — `docs/architecture/api-contract.md` əsasında.
**Daxildir:** `packages/contracts/openapi.yaml` (paths fayllara bölünə bilər: `paths/*.yaml`, `components/*.yaml`), ortaq sxemlər (`Money`, `Error`, `Page<T>`, enum-lar), hər endpoint üçün nümunə cavab (fixtures-dan), `security` (bearer), `Idempotency-Key`, `expected_version`. `@redocly/cli lint` + `pnpm contracts:lint`. `CONTRACT-CHANGELOG.md`-də `v0` qeydi.
**Daxil deyil:** backend implementasiyası, client generasiyası.
**Qəbul meyarları:**
- [ ] api-contract.md cədvəlindəki bütün endpoint-lər, status kodları və xəta kodları var
- [ ] Redocly lint xətasız; nümunələr sxemə uyğun
**Commit planı:** endpoint qrupuna görə: 1) ortaq komponentlər 2) auth/me/dashboard 3) packages read 4) documents/jobs 5) matches/fields/validate/signature 6) tasks 7) approve/export/report 8) audit/customers/notifications 9) lint config + changelog

---

### S-05 · `packages/api-client`
**Branch:** `feat/S-05-api-client` · **Asılılıq:** S-04
**Məqsəd:** Tip-təhlükəsiz client + format və i18n helper-ləri (web və mobile paylaşır).
**Daxildir:** `openapi-typescript` → `src/generated/schema.ts` (`pnpm generate`), `openapi-fetch` əsaslı `createApiClient({baseUrl, getToken})`, xəta tipi `ApiError{code,message,status}`; `src/format/` — `formatMoney`, `formatDate`, `formatDateTime`, `formatDateLong` (az-AZ, prototipdəki kimi; Decimal string-dən float-a çevirmədən); `src/i18n/az.ts` — bütün status/qayda/rol etiketləri (glossary.md), ümumi UI mətnləri; Vitest testləri.
**Daxil deyil:** React hook-ları (hər app öz `lib/`-ində).
**Qəbul meyarları:**
- [ ] `formatMoney("12000.00","AZN") === "12.000,00 AZN"`, `formatMoney("-500.00") === "−500,00"`
- [ ] Generasiya deterministikdir; `src/generated` commit olunub
- [ ] Testlər yaşıl, `typecheck` təmiz
**Commit planı:** 1) paket skeleti + generate 2) client + ApiError 3) format + testlər 4) i18n az

---

### S-06 · `packages/mocks` (MSW + mock mühərriki)
**Branch:** `feat/S-06-mocks` · **Asılılıq:** S-05 · **Skills:** `superpowers:test-driven-development`
**Məqsəd:** Backend olmadan web və mobile tam axını işləyə bilsin.
**Daxildir:** fixtures-dan in-memory store; prototipdəki `runChecks`/`info` məntiqinin TS portu (`src/engine/`, qəpik tam ədədləri ilə); bütün P0 endpoint-ləri üçün MSW handler-ləri (müqavilə tipləri ilə), dev-login (demo istifadəçilər), 409/403/idempotentlik davranışı, job simulyasiyası (gecikmə ilə), `resetMockDb()`; browser (`setupWorker`) və node (`setupServer`) export-ları; Vitest: mühərrik `expected.json`-a uyğundur, INV-1042 axını addım-addım.
**Daxil deyil:** UI.
**Qəbul meyarları:**
- [ ] 14 paketin statusu `expected.json` ilə eyni
- [ ] INV-1042 tam axını (link → upload → dublikat → akt → imza → təsdiq → ixrac) mock API ilə testdə keçir
- [ ] Operator approve → 403; köhnə versiya → 409; təkrar approve → eyni cavab
**Commit planı:** 1) store + fixtures loader 2–4) engine qaydaları (2-3 commit) 5) status törədilməsi + testlər 6) read handler-lər 7) write handler-lər (link, upload, field) 8) tasks/approve/export 9) audit/notifications/customers 10) INV-1042 axın testi

---

### S-07 · `packages/design-tokens`
**Branch:** `feat/S-07-design-tokens` · **Asılılıq:** S-01 · **Skills:** `frontend-design:frontend-design`
**Məqsəd:** Prototipin dizayn sistemini paylaşılan tokenlərə çevirmək.
**Daxildir:** `tokens.css` (prototipin `:root` və dark mode dəyişənləri — brand petrol `#0D5D6B`, neytrallar, semantik rənglər, spacing 4/8, radius, shadow, tipoqrafiya), `tailwind-preset.ts` (tokenlərə bağlı rənglər — hex yox), status→badge rəng xəritəsi, README nümunələri.
**Qəbul meyarları:**
- [ ] Light/dark dəyişənlər prototiplə eynidir
- [ ] Preset web və mobile-da import oluna bilir (S-08 CI-da typecheck)
**Commit planı:** 1) tokens.css light 2) dark 3) tailwind preset 4) README

---

### S-08 · CI, PR şablonu və repo-nun paylaşılması
**Branch:** `feat/S-08-ci` · **Asılılıq:** S-06, S-07 · **Skills:** `ci-cd-and-automation`
**Daxildir:** `.github/workflows/ci.yml` — path filtrləri ilə job-lar: `contracts` (redocly lint + client generate drift yoxlaması), `packages` (vitest, typecheck), `api` (ruff, mypy, pytest + postgres service; `apps/api/pyproject.toml` yoxdursa skip), `web`, `mobile` (lint, typecheck, vitest; app yoxdursa skip); commit ölçüsü yoxlaması (PR-dakı hər commit ≤200 sətir, hook ilə eyni skript `scripts/check-commit-size.sh`).
**Sonra (lead, əl ilə):** GitHub repo, `main` branch protection (PR + CI), komanda yoldaşını collaborator kimi əlavə etmək.
**Qəbul meyarları:**
- [ ] CI PR-da yaşıl; olmayan app-lər üçün job-lar skip olunur
- [ ] Komanda yoldaşı clone → `./scripts/setup.sh` → `pnpm install` → `pnpm --filter @payproof/mocks test` işləyir
**Commit planı:** 1) check-commit-size skriptini ayırmaq 2) ci.yml packages/contracts 3) api job 4) web/mobile job-ları
