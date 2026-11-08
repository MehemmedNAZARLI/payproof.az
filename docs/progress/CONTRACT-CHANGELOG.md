# API müqaviləsi — dəyişiklik jurnalı

`packages/contracts/openapi.yaml`-dakı hər dəyişiklik burada qeyd olunur (`/contract-change`). Frontend track-ləri yeni qeyd görəndə: `/sync` → `pnpm --filter @payproof/api-client generate` → mock-ları yoxla.

| Tarix | Versiya | Dəyişiklik | Pozucu? | Təsir edən track-lər | Branch |
|---|---|---|---|---|---|
| 2026-11-08 | v0 (0.1.0) | İlkin P0 müqaviləsi: api-contract.md-dəki 32 endpoint + `GET /v1/auth/dev-users` (dev-login seçimi üçün) + `GET /v1/users`, `GET /v1/exports/{id}/download` — cəmi 35 əməliyyat. Yeni xəta kodları: `IDEMPOTENCY_KEY_REUSED` (422), `IDEMPOTENCY_IN_PROGRESS` (409), `PACKAGE_NOT_DELETABLE` (409), `TASK_ALREADY_OPEN` (409), `INTERNAL_ERROR`. Approve/export `expected_requirement_set_version` tələb edir; `status` filtri çoxdəyərlidir; `PROCESSING` paketində `invoice_number/invoice_date/total` null ola bilər; dublikat faktura `Job.error.code=DUPLICATE_INVOICE`. Dəyişən paket əməliyyatları (match, field, signature-review, validate) yenilənmiş `PackageDetail` qaytarır; approve body-si `documents_reviewed: true` tələb edir | — | B, W, M | `feat/S-04-openapi` |
| 2026-11-08 | 0.1.1 | `Role` enum: `accounting`, `warehouse`, `sales` → `assignee` (ADR-0008 — tapşırıq icraçısı, icazəsiz, sistemə daxil olmur). Nümunələrdə icraçıların rolu `assignee`; audit nümunəsində sənədi operator yükləyir | Bəli (enum dəyərləri silinib; hələ istehlakçı yoxdur) | B, W, M | `docs/assignee-roles` |
