# PayProof — Claude Code üçün layihə qaydaları

PayProof B2B fakturanı sifariş və təhvil sənədləri ilə tutuşdurur, ödənişi ləngidə bilən sənəd problemlərini **mənbə sübutu ilə** göstərir, düzəlişi məsul şəxsə yönləndirir və hazır paketi **insan təsdiqindən** sonra ixrac edir. Tam məhsul təsviri: `docs/product/brief.md`. İşləyən UI prototipi: `docs/product/prototype/payproof-prototype.html` (bütün ekranların, mətnlərin və demo məlumatlarının mənbəyi).

## Repo xəritəsi
| Yol | Nə | Sahibi |
|---|---|---|
| `apps/api` | Python 3.12 · FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL | Backend track (B) |
| `apps/web` | Next.js · TypeScript · Tailwind · shadcn/ui · TanStack Query | Web track (W) |
| `apps/mobile` | Next.js PWA (mobil-first), təsdiqçi üçün | Mobile track (M) |
| `packages/contracts` | `openapi.yaml` — API müqaviləsi (tək həqiqət mənbəyi) | Shared (S) |
| `packages/api-client` | OpenAPI-dən generasiya olunan TS tipləri + client + format helper-lər | Shared |
| `packages/mocks` | MSW handler-ləri + fixtures əsaslı in-memory store | Shared |
| `packages/design-tokens` | Rəng/spacing/typography tokenləri, Tailwind preset | Shared |
| `fixtures/` | Sintetik demo dataset + gözlənilən nəticələr | Shared |
| `docs/` | Arxitektura, qaydalar, roadmap, step-lər, prompt-lar, progress | Hamı |

Hər app-in öz `CLAUDE.md` faylı var — həmin qovluqda işləyəndə onu da oxu.

## İş protokolu (məcburi)
1. İş **yalnız step** ilə görülür: `docs/roadmap/steps/*.md`. Step-i `/step <ID>` əmri ilə başla.
2. Başlamazdan əvvəl: step-in asılılıqları `docs/progress/*.md`-də ✅ olmalıdır; olmayıbsa dayan və de.
3. Hər step = **bir branch**: `feat/<STEP-ID>-<qısa-ad>` (məs. `feat/B-07-rules-engine-1`). `main`-ə birbaşa commit yoxdur.
4. Əvvəl qısa plan yaz (commit-lərə bölünmüş), sonra icra et. Step-in "Daxil deyil" siyahısındakı işi görmə.
5. **Kiçik commit-lər:** hər commit bir məntiqi addım, hədəf 50–150 sətir, **maksimum 200 sətir** (lock, generasiya olunan fayllar, fixtures və docs sayılmır). `.githooks/pre-commit` bunu yoxlayır. `--no-verify` qadağandır.
6. Commit mesajı: Conventional Commits + step ID: `feat(B-07): add R-001 PO reference rule`.
7. Test-first: domen məntiqi (qaydalar, pul, status, versiya) üçün əvvəl test, sonra kod.
8. Step bitəndə `/finish-step <ID>`: lint + typecheck + test keçməlidir, Definition of Done (`docs/engineering/definition-of-done.md`) yoxlanır, progress faylı yenilənir.
9. Başqa track-in qovluğuna toxunma. API müqaviləsini dəyişmək lazımdırsa — `/contract-change` prosesi.

## Domen invariantları (heç vaxt pozulmur)
- Pul **heç vaxt float deyil**: Python-da `Decimal`, API-də string (`"12000.00"`) + `currency`. AZN və USD bir cəmdə toplanmır.
- Qayda nəticələri: `PASS | FAIL | UNKNOWN | NOT_APPLICABLE`. **`UNKNOWN` heç vaxt `PASS` sayılmır** və məcburi qaydada paketi bloklayır.
- Qayda mühərriki deterministikdir və AI-dən asılı deyil. AI yalnız: çıxarış, mənbə istinadı, əlaqə **təklifi**, izah.
- Paket statusları: `PROCESSING → NEEDS_REVIEW | NEEDS_FIX → READY_FOR_APPROVAL → APPROVED_READY → EXPORTED`. `PAID` yoxdur.
- Sənəd, çıxarılmış kritik sahə, sifariş əlaqəsi və ya qayda dəyişəndə: paket versiyası artır, cari təsdiq etibarsızlaşır (auditdə qalır), yoxlama təkrarlanır.
- Təsdiq və ixrac **cari versiyaya** bağlıdır: köhnə versiya üçün sorğu `409`, təkrar sorğu yeni hadisə yaratmır (idempotent).
- Operator təsdiqləyə bilməz; təsdiqçi bloklanmış paketi təsdiqləyə bilməz. Səlahiyyət **serverdə** yoxlanır.
- Tapşırığı `RESOLVED` yalnız sistem edir — uyğun qayda keçəndə.
- Audit append-only-dir. Sənəd mətni log-lara yazılmır.
- UI mətnləri Azərbaycan dilindədir: "Paket göndərilməyə hazırdır" — heç vaxt "Ödəniş təmin edildi".

## Əmrlər (S-01-dən sonra işləyir)
- `make setup` · `make up` (postgres + minio) · `make seed` · `make test` · `make lint`
- Backend: `cd apps/api && uv run pytest` · `uv run ruff check .` · `uv run mypy .`
- Frontend: `pnpm --filter web dev|test|lint|typecheck` · `pnpm --filter mobile ...`
- Kontrakt: `pnpm --filter @payproof/api-client generate`

## Skills (mövcuddursa istifadə et)
Plan: `superpowers:writing-plans` · TDD: `superpowers:test-driven-development` · Paralel işləmə: `superpowers:using-git-worktrees` · API dizaynı: `api-and-interface-design` · UI: `frontend-ui-engineering`, `frontend-design:frontend-design` · Təhlükəsizlik: `security-and-hardening` · Bitirməzdən əvvəl: `superpowers:verification-before-completion`, `code-review`, `simplify`.

## Ətraflı sənədlər
- Başlanğıc: `docs/00-START-HERE.md`
- Arxitektura: `docs/architecture/` (overview, data-model, rules-engine, state-machines, api-contract, security, adr/)
- Mühəndislik qaydaları: `docs/engineering/` (coding-standards, git-workflow, testing, parallel-work, definition-of-done)
- Roadmap və step-lər: `docs/roadmap/ROADMAP.md`, `docs/roadmap/steps/`
- Progress: `docs/progress/` · Kontrakt dəyişiklikləri: `docs/progress/CONTRACT-CHANGELOG.md`
