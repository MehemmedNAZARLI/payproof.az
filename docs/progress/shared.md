# Progress — Shared (S)

Sahib: lead · Step təfərrüatları: `docs/roadmap/steps/shared.md`
Status: ⬜ başlanmayıb · 🟡 icrada · ✅ bitib (merge olunub) · 🚧 bloklanıb (səbəbi qeyddə)

Bu faylı yalnız bu track-in sessiyası yeniləyir (`/step` başlayanda 🟡, `/finish-step`-də ✅).

| Step | Ad | Status | Branch | Tarix | Qeyd |
|---|---|---|---|---|---|
| S-01 | Monorepo bootstrap | ✅ | `feat/S-01-monorepo` | 2026-11-08 | pnpm+turbo, tsconfig.base, prettier, Makefile |
| S-02 | Lokal infrastruktur (Docker Compose) | ✅ | `feat/S-02-infra` | 2026-11-08 | Chainguard minio images; ports configurable via .env |
| S-03 | Demo fixtures | ✅ | `feat/S-03-fixtures` | 2026-11-08 | generated from prototype engine; `pnpm fixtures:check` |
| S-04 | API müqaviləsi v0 (OpenAPI 3.1) | ✅ | `feat/S-04-openapi` | 2026-11-08 | 35 əməliyyat, `pnpm contracts:lint`; rol matrisi (warehouse/sales/accounting) açıq sual |
| S-05 | `packages/api-client` | ⬜ | | | |
| S-06 | `packages/mocks` (MSW + mock mühərriki) | ⬜ | | | |
| S-07 | `packages/design-tokens` | ✅ | `feat/S-07-design-tokens` | 2026-11-08 | tokens.css (prototype parity test), Tailwind preset + shadcn aliases, badge tones |
| S-08 | CI, PR şablonu və repo-nun paylaşılması | ⬜ | | | |
