# @payproof/mocks

Backend olmadan web və mobile **tam axını** işləsin deyə: `fixtures/`-dan in-memory demo şirkəti, prototipin qayda mühərrikinin TS portu (qəpik tam ədədləri ilə) və müqavilədəki **35 əməliyyatın hamısı** üçün MSW handler-ləri. Cavablar `packages/contracts/openapi.yaml`-a uyğundur — testlər hər cavabı sxemə qarşı yoxlayır.

## Qoşulma
**Brauzer** (`NEXT_PUBLIC_API_MOCK=1`):
```ts
// app tərəfi (client komponenti / provider), render-dən əvvəl
if (process.env.NEXT_PUBLIC_API_MOCK === "1") {
  const { createMockWorker } = await import("@payproof/mocks/browser");
  await createMockWorker().start(); // ~400 ms gecikmə, job-lar ~800 ms
}
```
App `public/mockServiceWorker.js` faylını servis edir. Worker skripti bu paketin MSW versiyası (3.x) ilə eyni olmalıdır, ona görə onu buradan yaradın:
`pnpm --filter @payproof/mocks exec msw init ../../apps/web/public` (mobile üçün `../../apps/mobile/public`).
`next.config`-də `transpilePackages: ["@payproof/mocks", "@payproof/api-client"]`. Paket monorepo kökündəki `fixtures/*.json` fayllarını import edir — Next/Turbopack-ın kök qovluğu monorepo olmalıdır (W-01/M-01-də yoxlanmalı; lazım olsa `turbopack.root`).

**Node / Vitest:**
```ts
import { server, resetMockDb } from "@payproof/mocks/node";
beforeAll(() => server.listen({ onUnhandledFrame: "error" })); // MSW v3: onUnhandledFrame (v2-də onUnhandledRequest idi)
afterEach(() => resetMockDb());
afterAll(() => server.close());
```
Ayrı instans lazımdırsa: `createMockServer({ latencyMs, jobDelayMs })` / `createMockWorker(options)`.

## Davranış
- **Giriş:** `POST /v1/auth/dev-login` (Aygün — operator, Rəşad — təsdiqçi, Kamran — yalnız baxış). Token `mock.<user-uuid>`-dir (JWT deyil). Tapşırıq icraçıları (ADR-0008) daxil ola bilmir.
- **Səlahiyyət** serverdəki kimi (`security.md`): operator təsdiqləyə bilmir → 403; readonly heç nə dəyişə bilmir.
- **Versiya:** hər dəyişiklik `expected_version` tələb edir → köhnə versiya 409 `VERSION_CONFLICT`; approve/export həm də `expected_requirement_set_version`.
- **İdempotentlik:** approve/export/upload/create `Idempotency-Key` ilə; eyni açar + eyni body → eyni cavab, fərqli body → 422. Approve/export açardan asılı olmayaraq cari versiya üçün mövcud qeydi qaytarır, yeni audit hadisəsi yaratmır.
- **Mühərrik:** `fixtures/expected.json` ilə eyni nəticə (14 paket, INV-1042 axını, yeni dəstlər) — golden testlər.
- **Saat:** demo vaxtı `2026-11-08T06:30Z`-dan başlayır, hər əməliyyat +2 dəq; cavab vaxtları UTC.
- **Canlı hadisələr** (ADR-0010): uğurlu yazma sorğusunun yaratdığı hər audit sətri və bildiriş bir `LiveEvent` olur (`mockApi.events.subscribe`); xəta/409/idempotent təkrar → hadisə yoxdur. `GET /v1/events` onları SSE kimi axıdır (`heartbeatMs`, default 15 s). Browser worker-i (`createMockWorker`) `BroadcastChannel('payproof-mock')` ilə eyni origin-in tab-larını sinxron saxlayır: yazan tab hadisəni mock DB snapshot-u ilə yayır, digər tab DB-ni götürüb hadisəni öz axınına verir.
- **ID-lər:** müqavilə nümunələrindəki oxunaqlı UUID-lər (`mockIds.pkg("pkg_1042")` → `0193a000-0000-7000-8002-000000001042`).

## Mock rejiminin bilərəkdən məhdudiyyətləri
- Yükləmədə çıxarış `fixtures/samples.json`-dakı faylın adına görə gəlir (`INV-1042_v2_PO-381.pdf`, `TS-5531_imzali.pdf`, …); tanınmayan fayl versiya kimi saxlanır, sahələr dəyişmir.
- Yeni paket yalnız demo dəstlərindən (`INV-1051.pdf`, `INV-1052.pdf`) yaranır; job sorğulananda emal bitir.
- Fayl növü uzantıya görə yoxlanır (real API məzmuna görə — B-13). `sha256` fayl adından hesablanır (fixtures konvensiyası).
- "İmzalı" linklər `*/mock-files/*` placeholder-ə aparır (mətn faylı).
- Tab sinxronu: eyni anda iki tab-da yazılarsa son snapshot qalib gəlir. `POST /v1/demo/reset` digər tab-lara ötürülmür (hadisəsi yoxdur) — onları yeniləyin, yoxsa köhnə tab-ın növbəti yazması köhnə DB-ni yayıb reset-i hamıda geri qaytarır. Veb (`:3000`) və mobil (`:3001`) ayrı origin-dir — bir-birini görmür; `Last-Event-ID` qəbul edilir, replay yoxdur.

## Testlər
`pnpm --filter @payproof/mocks test` — mühərrik (golden), domen əməliyyatları, serializer-lər (sxem), hər handler qrupu `@payproof/api-client` ilə, müqavilə əhatəsi (hər əməliyyatın handler-i var) və INV-1042 tam axını.
