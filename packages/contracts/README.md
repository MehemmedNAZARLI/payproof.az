# @payproof/contracts

`openapi.yaml` — PayProof API müqaviləsi (OpenAPI 3.1), **tək həqiqət mənbəyi**. Backend (B), web (W), mobile (M) və mock-lar (S-06) buna uyğunlaşır; TS tipləri buradan generasiya olunur (S-05, `@payproof/api-client`).

## Əmrlər
- `pnpm contracts:lint` — Redocly lint (`redocly.yaml`): struktur, istifadə olunmayan komponent yoxdur, hər əməliyyatda `operationId`/`summary`/4xx, **bütün nümunələr sxemə uyğundur** (`no-invalid-media-type-examples`, əlavə sahə qadağandır).

## Konvensiyalar (qısa — tam: `docs/architecture/api-contract.md`)
- `/v1`, `snake_case`, bearer JWT; `company_id` body-də qəbul edilmir.
- Pul: `{ amount: "12000.00", currency: "AZN" }` — string, float yox. Vaxt UTC (`…Z`).
- Siyahılar: `?limit&cursor` → `{ items, next_cursor }`.
- Versiyanı dəyişən sorğular `expected_version` göndərir → uyğun deyilsə `409 VERSION_CONFLICT`.
- Approve / export / upload / create: `Idempotency-Key` (müştəri bir dəfə yaradır, təkrarda eyni açar).
- Xəta: `{ error: { code, message, details } }`, `message` Azərbaycan dilindədir.
- Dəyişən paket əməliyyatları (match, field, signature-review, validate) yenilənmiş `PackageDetail` qaytarır.

## Nümunələr
Fixtures-dan (`fixtures/`): INV-1042 (əsas demo axını), INV-1044 (R-005), INV-1036 (etibarsızlaşan təsdiq), T-118. Nümunə ID-ləri oxunaqlı sabit UUID-lərdir (`0193a000-0000-7000-80TT-…`, `TT` = obyekt növü); real ID-lər server tərəfindən yaradılır.

## Dəyişiklik
Yalnız `/contract-change` ilə: ayrıca branch, `docs/progress/CONTRACT-CHANGELOG.md`-də qeyd, client regenerasiyası, mock-ların yoxlanması.
