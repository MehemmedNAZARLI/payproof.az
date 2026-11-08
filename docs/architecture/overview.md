# Arxitektura — ümumi baxış

## Məqsəd
Az komponentlə izlənə bilən, etibarlı MVP. Mikroservis, Kubernetes, ayrıca queue, native tətbiq və model öyrətmə **yoxdur**. Böyümə nöqtələri (connector, queue, provayder) interfeys arxasında saxlanılır ki, sonradan dəyişmək kodu dağıtmasın.

```
apps/web (Next.js)          apps/mobile (Next.js PWA)
        \                       /
         \   packages/api-client (OpenAPI-dən generasiya)
          \                   /
           ▼  HTTPS + JWT    ▼
apps/api (FastAPI) ── auth / tenant / permission (hər sorğuda)
 ├─ api/        HTTP router-lər (nazik: validasiya + servis çağırışı)
 ├─ services/   use-case-lər (tranzaksiya sərhədi, audit, versiya)
 ├─ domain/     təmiz domen: pul, qaydalar, status, versiya — I/O yoxdur
 ├─ repositories/  SQLAlchemy, tenant filtri məcburi
 ├─ extraction/ adapter interfeysi: mock | pdf_text | ocr | llm
 ├─ storage/    S3 client (MinIO lokal)
 └─ worker/     jobs cədvəli + SKIP LOCKED worker
PostgreSQL · MinIO
```

## Qatlar və asılılıq istiqaməti (backend)
`api → services → domain` və `services → repositories/storage/extraction`. **`domain` heç nəyi import etmir** (yalnız stdlib). Qayda mühərriki `domain/rules/` daxilindədir və `PackageSnapshot` (təmiz dataclass) qəbul edir — DB modeli yox.

## Frontend quruluşu (web və mobile eyni prinsip)
```
src/
  app/            Next.js route-ları (nazik)
  features/<ad>/  ekran + komponentlər + hooks (packages, package-detail, tasks, …)
  components/ui/  ümumi UI (shadcn əsaslı)
  lib/            api client, query client, auth, format
```
Server state yalnız TanStack Query ilə. UI mətnləri `@payproof/api-client/i18n`. Rənglər yalnız `@payproof/design-tokens`.

## Müqavilə əsaslı paralel iş
`packages/contracts/openapi.yaml` tək həqiqət mənbəyidir (ADR-0004):
1. Backend endpoint-i müqaviləyə uyğun yazır; contract test drift-i tutur (B-26).
2. Frontend generasiya olunmuş tiplərlə yazır; backend hazır deyilsə `packages/mocks` (MSW) cavab verir.
3. Müqavilə dəyişikliyi: `/contract-change` → `CONTRACT-CHANGELOG.md` → client regenerasiya → mock yeniləmə.

## Fon işləri
Uzun OCR/AI işi HTTP sorğusunu saxlamır. `jobs` cədvəli + `SELECT … FOR UPDATE SKIP LOCKED` worker (ADR-0005). UI `GET /v1/jobs/{id}` ilə vəziyyəti izləyir. Texniki xəta (`FAILED`) biznes uyğunsuzluğundan (`FAIL`) ayrıdır.

## Ətraf mühitlər
- Lokal: `docker compose up` (postgres, minio) + `uv run` + `pnpm dev`
- Demo/prod (sonra): Vercel (web, mobile) + Railway/Render (api, worker, postgres) + S3/R2
- Konfiqurasiya yalnız env ilə (`.env.example`), sirr repo-ya yazılmır.

## Sonrakı genişlənmə nöqtələri
- ERP connector-u (P1): `apps/api/src/payproof/connectors/<erp>/` — qayda mühərrikinə toxunmadan
- Queue: `JobQueue` interfeysi → Redis/SQS
- AI provayderi: `ExtractionAdapter` interfeysi
- Native mobil (lazım olsa): `apps/mobile`-i Expo ilə əvəzləmək; api-client və tokenlər paylaşılır
