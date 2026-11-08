# ADR-0004: Müqavilə əsaslı inkişaf (OpenAPI → generasiya olunan client → MSW)
**Status:** qəbul edilib · 2026-11-08

**Kontekst:** Backend, veb və mobil eyni vaxtda qurulur.

**Qərar:**
1. `packages/contracts/openapi.yaml` (OpenAPI 3.1) əl ilə yazılır və tək həqiqət mənbəyidir. Redocly lint CI-da.
2. `packages/api-client`: `openapi-typescript` ilə tiplər + `openapi-fetch` client. Generasiya olunan fayllar commit edilir (`src/generated/`), əl ilə dəyişdirilmir.
3. `packages/mocks`: MSW handler-ləri + fixtures əsaslı in-memory store + **TS-də sadə qayda mühərriki** (yalnız mock üçün; prototipdəki `runChecks`-in portu). `NEXT_PUBLIC_API_MOCK=1` ilə aktiv.
4. Backend FastAPI-nin generasiya etdiyi sxem `openapi.yaml` ilə contract test-də müqayisə olunur (B-26).
5. Dəyişiklik prosesi: `/contract-change` → `docs/progress/CONTRACT-CHANGELOG.md`.

**Nəticələr:** + frontend backend-i gözləmir; + tip təhlükəsizliyi. − mock məntiqi backend-lə ayrışa bilər → contract test və I-01 e2e bunu tutur.
