# apps/mobile — Mobil tətbiq (PWA) qaydaları

Track: **M** (`docs/roadmap/steps/mobile.md`). Əvvəl kök `CLAUDE.md`-ni oxu. Qovluq M-01-də yaradılır. Qərar: ADR-0002.
İstifadəçi: əsasən **təsdiqçi** (status + sübuta baxıb təsdiq). Operator/auditor yalnız baxır.
Vizual/mətn mənbəyi: prototipin "Mobil tətbiq" görünüşü (`docs/product/prototype/payproof-prototype.html`, yuxarıdakı keçid).

## Mobildə OLMAYANLAR
Sənəd yükləmə, çıxarış düzəlişi, sifariş seçimi, tapşırıq yaratma/dəyişmə, müştəri qaydaları, ixrac. Bunlar üçün "Vebdə aç" keçidi (`NEXT_PUBLIC_WEB_URL`).

## Quruluş
```
src/
  app/(auth)/login · app/(tabs)/{home,packages,notifications,profile}/page.tsx · app/packages/[id]/{page,approve,success}
  features/<feature>/{components/,hooks/,queries.ts}
  components/ui/      UI dəsti (M-03): AppHeader (iri başlıq, scroll-da yığılır), TabBar, BottomSheet (yay fizikası,
                      swipe-down, focus trap, Esc, arxa fon inert), ListGroup/ListItem, Chip, Card/SectionHeader,
                      Banner, Badge + status badge-ləri, Skeleton/ListSkeleton (shimmer), EmptyState, Button,
                      IconButton/CountBadge, Toaster + `toast` (toast-store.ts)
  lib/api.ts          `api` (openapi-fetch) + `unwrap` + `ApiError`; mock rejimində fetch səhifədaxili mock-a gedir
  lib/api/client.ts   createApiClient/ApiError — S-05 imzası ilə (shortcut: S-05 gələndə import dəyişir)
  lib/api/generated/  openapi.yaml-dan generasiya (`pnpm api:generate`; gitignore-dadır, dev/build/typecheck-dən əvvəl işləyir)
  lib/api/mock/       fixtures-dan store + MSW handler-ləri + createMockFetch (S-06 gələnə qədər; yalnız oxuma)
  lib/{query-client.ts,env.ts,format.ts,i18n.ts,spring.ts,cx.ts,brand.ts}
  features/<f>/queries.ts  query key factory + hook-lar (useMe, usePackages)
  app/kit/            UI dəstinin önizləməsi (/kit, yalnız mock rejimində; robots noindex)
  app/manifest.ts     → /manifest.webmanifest (rənglər lib/brand.ts-dən; brand.test.ts tokens.css ilə tutuşdurur)
  app/sw.ts + app/serwist/[path]/route.ts → /serwist/sw.js (Serwist, Turbopack; dev-də söndürülüb)
assets/icons/         ikon SVG mənbələri (public/-dan kənar — precache olunmasın); `node scripts/generate-icons.mjs` → public/icons/*.png, app/icon.svg, app/apple-icon.png
e2e/                  Playwright (iPhone 13 profili, Chromium; prod build :3101-də)
```

## Əmrlər
`pnpm --filter mobile dev` (:3001) · `build` · `start` (:3002 — dev ilə eyni origin olmasın, SW qarışmasın) · `lint` · `typecheck` · `test` (Vitest) · `e2e` (Playwright, öz build-ini qaldırır)
Mock: `NEXT_PUBLIC_API_MOCK=1` (default). Real: `NEXT_PUBLIC_API_MOCK=0`, `NEXT_PUBLIC_API_URL=http://localhost:8000`.
`pnpm --filter mobile api:generate` — API tipləri (dev/build/typecheck özü işlədir).

## Data qatı (M-02)
- Mock **səhifədaxilidir**: `createMockFetch` MSW handler-lərini `getResponse` ilə çağırır. MSW service worker yoxdur — scope-u Serwist tutur. DevTools-da `/v1/` sorğusu görünməz; offline-ı `navigator.onLine` ilə təqlid edir.
- Mock sessiyası: token `mock.<fixture slug>` (`mockToken("u1")`); token yoxdursa default demo təsdiqçi (Rəşad) — shortcut, M-04 dev-login gətirir.
- Statuslar `fixtures/expected.json`-dan (prototip mühərrikinin golden nəticəsi), mühərrik portu S-06-dadır.
- QueryClient: 30 s təzə, focus/reconnect-də yenilənir, sessiya boyu keşdə (offline göstərilir), 4xx təkrarlanmır. İlk yükləmə xətası ekranda (EmptyState + "Yenidən cəhd et"); fon yeniləməsi və mutation xətası → toast (`meta: { silentError: true }` ilə söndürülür).
- Massiv query parametrləri vergüllə (`status=A,B`, müqavilədəki `explode: false`).

## UI dəsti qaydaları (M-03)
- Bar materialı: `material` (yarımşəffaf surface + blur), ayırıcılar `hairline-t/b` (0.5px). Tab bar üçün səhifə `pb-tabbar` istifadə edir.
- Hərəkət: sheet — `lib/spring.ts` (yay fizikası, rubber-band, flick proyeksiyası); toast — `--ease-spring` (`linear()`). `prefers-reduced-motion`-da animasiya yoxdur.
- Tailwind v4-də `translate-*` `transform` deyil, ayrıca `translate` xassəsidir — JS ilə `transform` yazılan elementdə istifadə etmə.
- Hər interaktiv element ≥ 44×44 (Chip 36px görünür, `::before` ilə 44px toxunma sahəsi).

## Qaydalar
- Mobil-first: 360–430 px. Toxunma sahəsi ≥ 44×44. Safe area (`env(safe-area-inset-*)`). Üfüqi scroll yoxdur.
- Naviqasiya: alt tab bar (Əsas, Paketlər, Bildirişlər, Profil); detal ekranlarında sticky başlıq + geri.
- Təsdiq: **paket versiyasındakı bütün sənədlərə baxılmayınca** və "baxdım" qeydi işarələnməyincə təsdiq düyməsi işləmir. Versiya dəyişəndə baxılma sıfırlanır. `expected_version` + `Idempotency-Key`; 409 → yenilə və yenidən bax.
- Offline: keşdən yalnız oxuma; təsdiq offline mümkün deyil — aydın mesaj.
- API, i18n, format, tokenlər — `@payproof/*` paketlərindən (veblə eyni). Paylaşılan paketdə dəyişiklik lazımdırsa — lead ilə razılaşdır (`/contract-change` və ya ayrıca `fix/` branch).
- Hər ekran: skeleton, boş vəziyyət, xəta; light/dark; VoiceOver üçün label-lar.
- Service worker (`src/lib/sw-policy.ts`): `/v1/` və bütün cross-origin sorğular **NetworkOnly** — istifadəçi məlumatı Cache Storage-a düşmür. Oflayn keş siyasəti M-11-dədir.
- Brauzerin tap highlight-ı və pull-to-refresh söndürülüb: komponentlər öz `:active`/pressed vəziyyətini verir, yeniləmə öz düyməsi/jesti ilədir.
- UI step-i bitəndə 390×844 viewport-da (və 360, 430) brauzerdə yoxla.
