# apps/api — Backend qaydaları

Track: **B** (`docs/roadmap/steps/backend.md`). Əvvəl kök `CLAUDE.md`-ni oxu. Qovluq B-01-də yaradılır.

## Quruluş
```
apps/api/
  pyproject.toml  uv.lock  .python-version (3.12)  alembic.ini
  migrations/versions/          # generasiya olunur, commit limiti sayılmır
  src/payproof/
    api/          router-lər — nazik: schema → service → schema
    schemas/      Pydantic v2 request/response (yalnız HTTP sərhədi)
    services/     use-case-lər: tranzaksiya, versiya, audit, bildiriş
    domain/       təmiz: money, enums, permissions, snapshot, rules/ (I/O yoxdur!)
    repositories/ SQLAlchemy 2 async; BaseRepository tenant filtri ilə
    extraction/   adapterlər: mock, pdf_text, ocr, llm
    storage/      S3/MinIO
    worker/       job queue + worker
    core/         settings, logging, errors, db, auth
  tests/{domain,golden,integration,api}/
```

## Əmrlər
`uv sync` · `uv run payproof-api` (dev server, :8000) · `uv run payproof-worker` · `uv run payproof-seed --reset` · `uv run alembic upgrade head` · `uv run pytest -q` · `uv run ruff check . && uv run ruff format .` · `uv run mypy .`

## Qaydalar
- `domain/` heç nəyi import etmir (stdlib xaric). Qayda mühərriki `PackageSnapshot` qəbul edir — ORM modeli yox.
- Pul `Money`/`Decimal`; `float` qadağandır. API-də pul string.
- Hər yazma servisi: (1) `expected_version` yoxlaması, (2) dəyişiklik, (3) lazım olsa versiya artımı + təsdiq etibarsızlaşması, (4) audit, (5) revalidation — bir tranzaksiyada.
- Router-də `Depends(require(Permission.X))` məcburidir; tenant konteksti `current_member`-dən.
- Başqa tenant-ın obyekti → `NotFound` (404), `Forbidden` yox.
- Xəta mesajları Azərbaycan dilində (UI-də göstərilir); log mesajları ingiliscə, sənəd mətni olmadan.
- Endpoint əlavə edəndə `packages/contracts/openapi.yaml` ilə uyğunluğu yoxla; fərq varsa `/contract-change`.
- Golden testlər (`tests/golden`) `fixtures/expected.json` ilə; onları "keçsin deyə" dəyişmək qadağandır — fixtures səhvdirsə ayrıca `fix(S-03)` commit-i və səbəb.
