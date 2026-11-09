# Progress — Shared (S)

Sahib: lead · Step təfərrüatları: `docs/roadmap/steps/shared.md`
Status: ⬜ başlanmayıb · 🟡 icrada · ✅ bitib (merge olunub) · 🚧 bloklanıb (səbəbi qeyddə)

Bu faylı yalnız bu track-in sessiyası yeniləyir (`/step` başlayanda 🟡, `/finish-step`-də ✅).

| Step | Ad | Status | Branch | Tarix | Qeyd |
|---|---|---|---|---|---|
| S-01 | Monorepo bootstrap | ✅ | `feat/S-01-monorepo` | 2026-11-08 | pnpm+turbo, tsconfig.base, prettier, Makefile |
| S-02 | Lokal infrastruktur (Docker Compose) | ✅ | `feat/S-02-infra` | 2026-11-08 | Chainguard minio images; ports configurable via .env |
| S-03 | Demo fixtures | ✅ | `feat/S-03-fixtures` | 2026-11-08 | generated from prototype engine; `pnpm fixtures:check` |
| S-04 | API müqaviləsi v0 (OpenAPI 3.1) | ✅ | `feat/S-04-openapi` | 2026-11-08 | 35 əməliyyat, `pnpm contracts:lint`; icraçı rolları → `assignee` (ADR-0008) |
| S-05 | `packages/api-client` | ✅ | `feat/S-05-api-client` | 2026-11-08 | openapi-fetch client + ApiError/unwrap/toFormData, az format, i18n; generation drift test |
| S-06 | `packages/mocks` (MSW + mock mühərriki) | ✅ | `feat/S-06-mocks` | 2026-11-08 | 35/35 əməliyyat, golden = expected.json, INV-1042 axını; ADR-0009 |
| S-07 | `packages/design-tokens` | ✅ | `feat/S-07-design-tokens` | 2026-11-08 | tokens.css (prototype parity test), Tailwind preset + shadcn aliases, badge tones |
| S-08 | CI, PR şablonu və repo-nun paylaşılması | ✅ | `feat/S-08-ci` | 2026-11-08 | GitHub Actions; tələb olunan yoxlama: `ci`; branch protection quruldu (PR + ci tələb olunur) |
| S-09 | Canlı hadisələr müqaviləsi və mock axını | ✅ | `feat/S-09-live-events` | 2026-11-08 | ADR-0010; müqavilə 0.2.0 (`GET /v1/events`, `LiveEvent`); `subscribeEvents` (fetch SSE, `Last-Event-ID`, backoff, 401-də dayanır, callback xətası bağlantını qırmır); mock: hadisə uğurlu yazmanın audit/bildiriş sətirlərindən, MSW SSE axını, `BroadcastChannel` tab sinxronu (DB snapshot). Brauzerdə (Chromium, :3010) iki tab: ~0,4 s. Açıq (W-05b/M-04b): StrictMode-da axının təmizlənməsini real brauzerdə yoxla |
