# @payproof/api-client

Web və mobile-in paylaşdığı client: `packages/contracts/openapi.yaml`-dan generasiya olunan tiplər, `openapi-fetch` əsaslı client, az-AZ format helper-ləri və Azərbaycan dilində etiketlər. React hook-ları burada deyil — hər app öz `lib/`-ində.

| Export | Nə |
|---|---|
| `@payproof/api-client` | `createApiClient`, `ApiError`, `unwrap`, `toFormData`, tiplər (`paths`, `Schemas["PackageDetail"]`, …) |
| `@payproof/api-client/format` | `formatMoney`, `formatQuantity`, `formatDate`, `formatDateTime`, `formatDateLong` |
| `@payproof/api-client/i18n` | status, qayda, rol, səlahiyyət, sənəd, müqayisə, job, `fix_hint` etiketləri, `errorFallback`, `ui` mətnləri |

## Next.js
Paket TS mənbəyini export edir (build yoxdur):
```ts
// next.config.ts
export default { transpilePackages: ["@payproof/api-client", "@payproof/design-tokens"] };
```

## İstifadə
```ts
const api = createApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL!, getToken: () => session.token });

// TanStack Query: unwrap → non-optional data; uğursuz cavab ApiError atır
useQuery({ queryKey: ["package", id], queryFn: ({ signal }) =>
  unwrap(api.GET("/v1/packages/{package_id}", { params: { path: { package_id: id } }, signal })) });

// Multipart + Idempotency-Key (açar istifadəçi niyyəti üçün bir dəfə yaradılır, təkrarda eyni qalır)
await api.POST("/v1/packages/{package_id}/documents", {
  params: { path: { package_id: id }, header: { "Idempotency-Key": key } },
  body: { type: "invoice", file, expected_version: pkg.version },
  bodySerializer: toFormData,
});
```
- `ApiError{code, message, status, details}`: `message` Azərbaycan dilindədir və UI-də göstərilə bilər; `409 VERSION_CONFLICT` → "Paket yenilənib" dialoqu + refetch.
- Şəbəkə xətası → `NETWORK_ERROR` (status 0, `cause` saxlanır). Ləğv edilmiş sorğu (`AbortSignal`) `ApiError` deyil — orijinal `AbortError` qayıdır.
- **Canlı hadisələr** (ADR-0010): `subscribeEvents({ baseUrl, getToken, onEvent, onOpen, onError, signal })` → `stop()`. `fetch` əsaslıdır (token `Authorization` header-ində, URL-də yox), `Last-Event-ID` göndərir, qırılanda 1 s → 30 s backoff ilə yenidən qoşulur, `401`-də dayanır (`onError(ApiError UNAUTHENTICATED)`). `onOpen` hər (yenidən) qoşulmada çağırılır — orada bütün keşi invalidate edin; hadisə yalnız ID daşıyır, məlumatı REST-dən alın.
- `fetch` verilməsə, hər sorğuda `globalThis.fetch` götürülür — MSW (node, `setupServer`) client-dən sonra işə salınsa da tutur.

## Format
- Pul və miqdar **string** qalır; qruplaşdırma rəqəmlər üzərində aparılır, `Number()` yoxdur. `formatMoney("12000.00","AZN")` → `12.000,00 AZN`, `formatMoney("-500.00")` → `−500,00`.
- Vaxtlar `Asia/Baku` ilə göstərilir (`2026-11-03T05:12:00Z` → `03.11.2026, 09:12`); ofsetsiz vaxt və mövcud olmayan tarix xəta atır. Yalnız tarix (`2026-11-03`) vaxt zonası ilə sürüşmür.

## Generasiya
`pnpm --filter @payproof/api-client generate` (`scripts/schema.mjs`) — determinist; multipart fayl sahələri `Blob` kimi tiplənir. `src/generated/` commit olunur; `test/generated.test.ts` onun müqavilə ilə eyni olduğunu yoxlayır (müqavilə dəyişib, generate unudulubsa test qırmızıdır).
