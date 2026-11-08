# packages/

Shared track (S) tərəfindən yaradılır. Web və mobile eyni paketləri istifadə edir.

| Paket | Step | Nə |
|---|---|---|
| `contracts` | S-04 | `openapi.yaml` — API müqaviləsi |
| `api-client` (`@payproof/api-client`) | S-05 | Generasiya olunan tiplər, client, `format/`, `i18n/az.ts` |
| `mocks` (`@payproof/mocks`) | S-06 | MSW handler-ləri, fixtures store, mock qayda mühərriki |
| `design-tokens` (`@payproof/design-tokens`) | S-07 | `tokens.css`, Tailwind preset |

Dəyişiklik: kiçik ayrıca branch (`contract/…` və ya `fix/S-0x-…`), tez merge, `CONTRACT-CHANGELOG.md` (müqavilə üçün).
