# PayProof

> Find the document issue before it becomes a payment delay.

PayProof B2B satış fakturasını müştərinin sifarişi və təhvil sənədi ilə tutuşdurur, ödənişi ləngidə bilən sənəd problemlərini mənbə sübutu ilə göstərir, düzəlişi məsul şəxsə yönləndirir və hazır paketi insan təsdiqindən sonra ixrac edir.

**Status:** MVP (P0) implementasiyası başlayır. Bütün demo məlumatları sintetikdir.

## Komponentlər
| | Texnologiya | İstifadəçi |
|---|---|---|
| `apps/api` | Python 3.12, FastAPI, PostgreSQL, S3 (MinIO) | — |
| `apps/web` | Next.js, TypeScript, Tailwind, shadcn/ui | Maliyyə komandası (operator, təsdiqçi, auditor) |
| `apps/mobile` | Next.js PWA (mobil-first) | Təsdiqçi (status + təsdiq) |
| `packages/*` | API müqaviləsi, generasiya olunan client, mock-lar, dizayn tokenləri | — |

## Başlamaq
1. `docs/00-START-HERE.md` — kim nəyi oxuyur, necə başlanır.
2. Alətlər: Node 22+, pnpm 9+, [uv](https://docs.astral.sh/uv/), Docker, git, Claude Code.
3. `./scripts/setup.sh` — git hook-larını aktivləşdirir və alətləri yoxlayır.
4. Claude Code-u repo kökündə açın və `/next-step shared` yazın.

### Lokal infrastruktur
`make up` PostgreSQL 16 və MinIO-nu qaldırır və `payproof-docs` bucket-ini yaradır; `make down` dayandırır (məlumat `.data/`-da qalır), `make logs`, `make psql`.
- Postgres: `localhost:5432`, MinIO API: `localhost:9000`, konsol: http://localhost:9001 (giriş: `S3_ACCESS_KEY` / `S3_SECRET_KEY`).
- Port məşğuldursa `.env`-də `POSTGRES_PORT`, `MINIO_PORT`, `MINIO_CONSOLE_PORT`-u dəyişin və `DATABASE_URL` / `S3_ENDPOINT_URL`-u uyğunlaşdırın.

### Çıxarış (AI) və göndərmə
Provayder yalnız env ilə seçilir (ADR-0011 §5); `.env.example`-a baxın.
- `AI_PROVIDER=mock` (default) — hazır demo nəticələri, açar tələb olunmur; `pdf` — yalnız faktura PDF mətn qatı.
- `AI_PROVIDER=anthropic` — Claude (rəsmi Python SDK). `AI_API_KEY` məcburidir (yoxdursa API və worker başlamır); `AI_MODEL` boşdursa `claude-opus-5-5`; `AI_BASE_URL` — proksi üçün. Hər sahə `value + page + quote + confidence` ilə qayıdır; `AI_MIN_CONFIDENCE`-dən aşağı və ya mənbəsiz dəyər oxunmamış sayılır (yoxlama `UNKNOWN`), heç vaxt təxmin edilmir. Sənəd mətni və açar log-a yazılmır.
- `AI_PROVIDER=openai` — eyni interfeys arxasında stub (konfiqurasiya yoxlanılır, çıxarış hələ yoxdur).
- İxrac e-poçtu: `RESEND_API_KEY` (+ `RESEND_FROM`); açar yoxdursa dev/test yalnız log yazır, prod `FAILED` qeyd edir.

## Sənədlər
- Məhsul: `docs/product/` (brif, prototip, komanda bələdçisi PDF)
- Arxitektura: `docs/architecture/`
- Mühəndislik qaydaları: `docs/engineering/`
- Roadmap və step-lər: `docs/roadmap/`
- Prompt-lar: `docs/prompts/`
- Progress: `docs/progress/`

## Prototip
`docs/product/prototype/payproof-prototype.html` faylını brauzerdə açın — internetsiz işləyir, veb və mobil görünüşləri, 13 addımlı demo bələdçisi var. Implementasiyada ekranlar, mətnlər, statuslar və demo dataset buradan götürülür.
