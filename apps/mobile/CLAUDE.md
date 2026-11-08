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
  components/ui/      AppHeader, TabBar, BottomSheet, ListItem, Chip, …
  lib/{api.ts,query-client.ts,auth.ts,msw.ts,seen-docs.ts}
public/manifest.webmanifest, icons/
e2e/                  Playwright (iPhone 13 profili)
```

## Əmrlər
`pnpm --filter mobile dev` (:3001) · `build` · `lint` · `typecheck` · `test` · `e2e`
Mock: `NEXT_PUBLIC_API_MOCK=1` (default). Real: `NEXT_PUBLIC_API_MOCK=0`, `NEXT_PUBLIC_API_URL=http://localhost:8000`.

## Qaydalar
- Mobil-first: 360–430 px. Toxunma sahəsi ≥ 44×44. Safe area (`env(safe-area-inset-*)`). Üfüqi scroll yoxdur.
- Naviqasiya: alt tab bar (Əsas, Paketlər, Bildirişlər, Profil); detal ekranlarında sticky başlıq + geri.
- Təsdiq: **paket versiyasındakı bütün sənədlərə baxılmayınca** və "baxdım" qeydi işarələnməyincə təsdiq düyməsi işləmir. Versiya dəyişəndə baxılma sıfırlanır. `expected_version` + `Idempotency-Key`; 409 → yenilə və yenidən bax.
- Offline: keşdən yalnız oxuma; təsdiq offline mümkün deyil — aydın mesaj.
- API, i18n, format, tokenlər — `@payproof/*` paketlərindən (veblə eyni). Paylaşılan paketdə dəyişiklik lazımdırsa — lead ilə razılaşdır (`/contract-change` və ya ayrıca `fix/` branch).
- Hər ekran: skeleton, boş vəziyyət, xəta; light/dark; VoiceOver üçün label-lar.
- UI step-i bitəndə 390×844 viewport-da (və 360, 430) brauzerdə yoxla.
