---
description: API müqaviləsini (openapi.yaml) dəyişmək prosesi
argument-hint: <dəyişikliyin qısa təsviri>
---

Dəyişiklik: **$ARGUMENTS**

1. Cari işi commit et. Yeni branch: `contract/<kebab-ad>` (`main`-dən).
2. `docs/architecture/api-contract.md` konvensiyalarına uyğun olaraq `packages/contracts/openapi.yaml`-ı dəyiş (`api-and-interface-design` skill-i varsa istifadə et). Mümkünsə **pozucu olmayan** dəyişiklik: yeni sahə optional, köhnə sahə silinmir.
3. `pnpm contracts:lint` → `pnpm --filter @payproof/api-client generate` → `packages/mocks` handler-lərini yenilə → `pnpm turbo run typecheck test --filter=./packages/*`.
4. `docs/architecture/api-contract.md` cədvəlini və `docs/progress/CONTRACT-CHANGELOG.md`-ə sətir əlavə et (tarix, dəyişiklik, pozucu?, təsir edən track-lər).
5. Kiçik commit-lər: `feat(contract): …`. PR aç; başlıqda `[contract]`. Digər track sahiblərinə nəyi `/sync` etməli olduqlarını yaz.
6. Merge-dən sonra əvvəlki step branch-ına qayıt və `/sync`.
