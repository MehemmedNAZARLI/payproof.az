# ADR-0001: Monorepo (pnpm workspace + Turborepo + uv)
**Status:** qəbul edilib · 2026-11-08

**Kontekst:** Backend, veb və mobil paralel qurulur, eyni API müqaviləsini, mock-ları və dizayn tokenlərini paylaşır.

**Qərar:** Bir repo. `apps/api` (Python, uv ilə idarə olunur), `apps/web`, `apps/mobile`, `packages/*` (pnpm workspace). Turborepo JS tapşırıqlarını (lint, test, build) keş ilə işlədir; `Makefile` hər iki dünyanı bir əmrlə birləşdirir.

**Nəticələr:** + müqavilə dəyişikliyi bir PR-da hər tərəfə yayılır; + bir CI. − Python və Node alətləri birlikdə qurulmalıdır (`scripts/setup.sh`).
