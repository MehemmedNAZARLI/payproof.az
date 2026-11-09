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
  lib/api/mock/       fixtures-dan store + MSW handler-ləri + createMockFetch (S-06 gələnə qədər); yazılar
                      (təsdiq, oxunmuş bildiriş, idempotency cavabları) session-db.ts-də (sessionStorage);
                      engine/ — prototip qayda mühərrikinin portu (mesaj, sübut), paper.ts — mock sənəd kağızı
  lib/{query-client.ts,env.ts,format.ts,i18n.ts,spring.ts,cx.ts,brand.ts,status-tone.ts,fonts.ts}
  styles/tokens.css   mobil dizayn sistemi (yalnız mobil; veb @payproof/design-tokens-də qalır) + tokens.test.ts (kontrast)
  lib/session.ts      dev-login sessiyası (localStorage), useSession, watchUserChange; lib/runtime-caches.ts — çıxışda SW keşləri
  app/(tabs)/layout.tsx · app/packages/layout.tsx   SessionGate + (tabs üçün) TabBar
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
- Mock sessiyası: token `mock.<fixture slug>` (`mockToken("u1")`), `POST /v1/auth/dev-login` verir; tokensiz sorğu → 401.
- Mock həmçinin `GET /v1/auth/dev-users`, `GET /v1/dashboard` (fixtures-dan, golden test) və `GET /v1/audit` (tarixçə prototipin `reset()` qaydası ilə fixtures-dan törədilir; yalnız `limit`, `package_id`) verir.
- Statuslar `fixtures/expected.json`-dan (prototip mühərrikinin golden nəticəsi), mühərrik portu S-06-dadır.
- QueryClient: 30 s təzə, focus/reconnect-də yenilənir, sessiya boyu keşdə (offline göstərilir), 4xx təkrarlanmır. İlk yükləmə xətası ekranda (EmptyState + "Yenidən cəhd et"); fon yeniləməsi və mutation xətası → toast (`meta: { silentError: true }` ilə söndürülür).
- Massiv query parametrləri vergüllə (`status=A,B`, müqavilədəki `explode: false`).

## Sessiya və naviqasiya (M-04…M-06)
- Sessiya `lib/session.ts`: dev-login JWT + `Me` localStorage-da (`payproof.session`), `useSession()` (`useSyncExternalStore`; hidrasiyada `undefined`), başqa tabdakı çıxışı izləyir. Token `api`-yə buradan gedir.
- `SessionGate` (`(tabs)/layout.tsx`, `packages/layout.tsx`, `/kit`): sessiya yoxdursa `/login?next=<yol>`; istifadəçi özü çıxıbsa `next`-siz. `safeNextPath` yalnız tətbiqdaxili yolu qəbul edir. Bu yalnız naviqasiyanı qoruyur — səlahiyyət serverdədir.
- 401 (istənilən query/mutation, vaxtı keçmiş token da) → sessiya bitir (`expired`); token vaxtında özü də bitir (timer + `visibilitychange`). Giriş ekranı səbəbi banner ilə deyir.
- İstifadəçi dəyişəndə (çıxış, vaxt bitməsi, başqa tabda giriş/çıxış) `watchUserChange` → Query keşi və SW runtime keşləri təmizlənir (`providers.tsx`).
- Ekranlar əvvəl `data`-ya baxır: fon yeniləməsi uğursuz olsa məlumat qalır (toast), xəta kartı yalnız heç nə yüklənməyibsə. Offline "Yenilə" sorğu göndərmir — toast.
- Çıxış (`useSignOut`): sessiya → Query keşi `clear()` → SW runtime keşləri (`clearRuntimeCaches`; Serwist precache saxlanılır — o yalnız ictimai app shell-dir). Girişdə də Query keşi təmizlənir.
- Paket filtri və axtarış URL-dədir (`features/packages/filters.ts`: `?status=ready|problem|approved|exported&q=`); çip sayları `/v1/dashboard`-un `status_counts`-undan.
- Tarixlər Bakı vaxtı ilə (`formatDateTime`, `formatLongDate`, `greeting` — `lib/format.ts`).

## Paket detalı və sübut (M-07, M-08)
- `features/package-detail/`: `usePackage(id)` (`packageKeys.all` altında — paketlər yenilənəndə detal da yenilənir), `useDocumentFile(versionId)` (imzalı link 5 dəq; 4 dəq təzə sayılır), `cta.ts` (CTA vəziyyəti status + serverin `permissions`-ından, rol cihazda yoxlanmır).
- Mock detal: `lib/api/mock/package-detail.ts` + `engine/` (prototipin `runChecks` portu; nəticələr `expected.json` ilə golden, sitatlar `engine/quotes.ts`-də). Bütün mock cavabları `src/test/contract.ts` ilə `openapi.yaml`-a qarşı yoxlanır.
- Sübut sheet-i (`components/evidence-sheet.tsx` + `sheet-stack.ts`): bir `BottomSheet`, səhifələr yığını (yoxlama → sənəd → Geri). `BottomSheet`-in `page`/`direction` prop-ları səhifəni sürüşdürür və hündürlüyü morph edir; `size="large"` sənəd üçündür (landşaftda tam ekran, footer gizlənir, "Geri" başlığa keçir — `short:` variantı, `globals.css`).
- Sənəd görüntüləyici (`features/document-viewer/`): link `mock:paper/` ilə başlayırsa (`lib/api/mock-file.ts`) fixtures-dan kağız (`lib/api/mock/paper.ts` → `paper.tsx`, lazy chunk); əks halda `source_kind`-ə görə react-pdf (`pdf-pages.tsx`, lazy; worker `pdfjs-dist`-dən `new URL(..., import.meta.url)`), skan şəkli və ya cədvəl üçün "Faylı aç". Vurğu: kağızda sitat bərabərliyi, PDF/skanda `bbox`; tapılmırsa "səhifə + sitat" göstərilir (təxmini vurğu yoxdur).
- `ZoomPane`: səhifə enə sığır (geniş ekranda 640px-də dayanır), pinch/double-tap/ctrl+wheel/± düymələri fokus nöqtəsini saxlayır; pinch zamanı yalnız transform, buraxanda bir dəfə layout. Sitatdan açılanda mətn ~12.5px olana qədər böyüdülür.
- Baxılma (`seen-store.ts`): sessionStorage `payproof.seen`, açar istifadəçi + paket, dəyər paket versiyası + baxılmış sənəd versiyaları; versiya dəyişəndə boş sayılır; istifadəçi dəyişəndə `providers.tsx` silir. Sənəd ekranda göründükdən sonra işarələnir (açılış deyil). Yalnız UX qoruyucusudur.

## Təsdiq və bildirişlər (M-09, M-10)
- Təsdiq vərəqəsi sübut sheet-inin bir səhifəsidir (`SheetRoute { kind: "approve" }`): sənəd oradan bir səviyyə dərinə açılır, "Geri" vərəqəyə qaytarır. Vəziyyət (`features/approval/use-approval-flow.ts`) sheet-dən yuxarıdadır: "baxdım" qeydi paket **versiyasına** bağlıdır (versiya dəyişəndə özü düşür), `Idempotency-Key` hər cəhd üçün bir dəfə yaradılır və həmin cəhdin təkrarlarında saxlanılır (409 VERSION_CONFLICT → yeni açar).
- "Təsdiqlə" kilidli ikən `aria-disabled`-dir (həqiqi `disabled` yox): toxunuş çatışmayan addımı titrədir + haptik. Göndərilən sorğu zamanı ref qoruyucusu ikinci toxunuşu udur.
- Xətalar vərəqədə izah olunur (`FailureBanner`, `role="alert"`): 409 conflict → yenidən bax, 403 → səlahiyyət, offline (`useOnline`) → "təsdiq oflayn mümkün deyil"; 409 PACKAGE_NOT_READY → vərəqə bağlanır + toast. Mutasiya `silentError`-dur.
- Uğurdan sonra `approval-cache.ts` cavabı detal, bütün siyahı səhifələri (filtrə görə çıxarır və ya yenidən etiketləyir) və dashboard-a (say + `ready_amounts`, BigInt sent) dərhal yazır, sonra hamısı yenidən sorğulanır (gözlənilmir). Uğur ekranı `/packages/[id]/success` yalnız `current_approval` varsa uğuru göstərir.
- Haptik (`lib/haptics.ts`): Android-də Vibration API, iOS 18+-da gizli `switch` checkbox; mənası həmişə ekranda da var.
- Bildirişlər (`features/notifications/`): bir query (`["notifications","list"]`, 60 s polling ön planda) — siyahı, tab bar, zəng və app ikonu (Badging API) eyni `unread_count`-u oxuyur. Oxuma optimistikdir (xətada geri qaytarılır). Qruplar Bakı günü ilə ("Bu gün", "Dünən", "6 noyabr, cümə") — prototipin "Yeni/Əvvəlki" əvəzinə (istifadəçi qərarı); oxunmamış nöqtə + qalın mətn + ekran oxuyucu üçün "Oxunmamış". Toxunuş → oxundu + paketə keçid.
- Mock: təsdiq paketin sahibinə bildiriş yaradır; təsdiq statusu siyahı, dashboard, detal və auditə tətbiq olunur (`mock/live.ts`). Yeni tab fixtures-dan başlayır.

## Dizayn sistemi
- Palitra: light `bg #F5F6FA / surface #FFF / surface-2 #EEF0F6`, dark `#05060A / #0E1018 / #161926`; **bir accent** (`#3D5AFE` / dark `#6E86FF`). Mətn üçün `accent`, ağ mətnli dolu düymə üçün `accent-fill` (dark-da `#4B65FF` — `#6E86FF` üzərində ağ 3.2:1-dir).
- Semantik rənglər iki qatlıdır: `success|warning|danger` (parlaq — dolğu/ikon), `*-ink` (mətn), `*-soft` (fon). Badge = `soft` + `ink` (`lib/status-tone.ts`). Bütün mətn cütləri `tokens.test.ts`-də 4.5:1 yoxlanır — yeni cüt əlavə edəndə testə də yaz.
- Hero kart (`hero` utility): navy qradiyent `#0B1026 → #1B2550` + accent parıltısı, hər iki temada ağ mətn (`text-hero-text2`, `bg-hero-fill`).
- Tipoqrafiya: Inter (`lib/fonts.ts`, `next/font/local`, Latin + Latin Extended — ə/ğ/ş üçün), iOS miqyası: `text-large` (34/41, -0.4) · `title1..3` · `headline` · `body` · `callout` · `subhead` (default) · `footnote` · `caption` · `caption2`. Rəqəmlər `tabular-nums`. `tracking-*`/`leading-*` ilə miqyası pozma.
- Səthlər sərhədsizdir: kölgə `shadow-1|2|3|accent` (dark-da üst highlight). Siyahılar inset grouped (`ListGroup`), künclər 12/16/22 px; `corner-shape` dəstəklənirsə squircle (`globals.css`).
- Toxunuş: `press` utility (sürətli batma, yay ilə qayıdış). Avatar rəngləri düz açarlardır (`bg-av-1`): iç-içə rəqəmli açarı Tailwind v4 JS-config körpüsü atır.

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
- API, i18n, format — `@payproof/*` paketlərindən (veblə eyni). Tokenlər mobilə məxsusdur: `src/styles/tokens.css` + `tailwind.config.ts` + `lib/status-tone.ts` (`@payproof/design-tokens` mobil tərəfindən istifadə olunmur). Paylaşılan paketdə dəyişiklik lazımdırsa — lead ilə razılaşdır (`/contract-change` və ya ayrıca `fix/` branch).
- Hər ekran: skeleton, boş vəziyyət, xəta; light/dark; VoiceOver üçün label-lar.
- Service worker (`src/lib/sw-policy.ts`): `/v1/` və bütün cross-origin sorğular **NetworkOnly** — istifadəçi məlumatı Cache Storage-a düşmür. Baxılmış səhifələr (HTML/RSC, şəxsi məlumatsız) Serwist-in network-first default-ları ilə keşlənir.
- Yeniləmə (`features/pwa/sw-update.ts`, `update-prompt.tsx`): `skipWaiting: false`; yeni versiya sticky toast ("Yeni versiya hazırdır" + "Yenilə") — qəbul → `SKIP_WAITING`, `controllerchange`-də reload. İlk quraşdırma (`isUpdate` yox) yeniləmə sayılmır. e2e deploy-u `?v=2` URL-i ilə təqlid edir (brauzerin öz update fetch-i route olunmur).
- Oflayn oxu keşi (`lib/query-persist.ts`): uğurlu query-lər (`packages`, `dashboard`, `audit`, `notifications`, `auth/me`; `document-file` yox) localStorage `payproof.cache`-də istifadəçi id-si ilə; hər query 24 saat yaşayır; hidrasiyadan sonra bərpa olunur; istifadəçi dəyişəndə və açılışda başqasınındırsa/sessiya yoxdursa silinir. Oflayn: başlıq altında zolaq (`AppHeader`), heç nə saxlanmayıbsa `OfflineCard`, detalda təsdiq düyməsi `disabled`, approve mutasiyası `networkMode: "always"` (növbəyə düşmür).
- Quraşdırma ipucu (`features/pwa/install.ts`): `beforeinstallprompt` modul yüklənəndə tutulur (`providers.tsx` import edir); iPhone/iPad Safari üçün addımlar sheet-i; bağlanması `payproof.installHint`-də yadda qalır.
- Brauzerin tap highlight-ı və pull-to-refresh söndürülüb: komponentlər öz `:active`/pressed vəziyyətini verir. Yeniləmə öz jestimizlədir: `PullToRefresh` (`components/ui/pull-to-refresh.tsx` + `use-pull-gesture.ts` + `pull-model.ts`) tab kökünü bürüyür; iri başlıq və `main` `pull-shift` ilə hərəkət edir (transform yalnız çəkərkən), bar yerində qalır; həddi keçəndə haptik + yeniləmə, `refreshAll` (`lib/refresh.ts`) oflaynda sorğu göndərmir. Non-passive `touchmove` yalnız yuxarıdan başlayan toxunuşda qoşulur. Klaviatura/ekran oxuyucu üçün fokusda görünən "Məlumatı yenilə" düyməsi.
- Sheet paneli `overflow-clip-safe`-dir: `overflow: hidden` fokusla scroll oluna bilir (landşaftda panel ekrandan çıxırdı).
- UI step-i bitəndə 390×844 viewport-da (və 360, 430) brauzerdə yoxla.
