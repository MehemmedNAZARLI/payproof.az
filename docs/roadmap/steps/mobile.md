# Mobile track (M) — `apps/mobile`

**Sahib:** mobil komanda yoldaşı · **İstifadəçi:** əsasən **təsdiqçi** (maliyyə direktoru); operator və auditor yalnız baxır.
**Nə qurulur:** status izləmə + sübuta baxıb təsdiq. Yükləmə, düzəliş, sifariş seçimi, tapşırıq yaratma, qaydalar, ixrac **mobildə yoxdur** — "Vebdə aç" keçidi (ADR-0002).
**Stack:** Next.js (App Router) + TypeScript strict, mobil-first, PWA (Serwist: manifest + service worker), Tailwind + `@payproof/design-tokens`, TanStack Query, react-pdf, Vitest + RTL, Playwright (mobil viewport 390×844).
**Vizual və mətn mənbəyi:** `docs/product/prototype/payproof-prototype.html` → yuxarıdan "Mobil tətbiq" görünüşü. Oxu: `apps/mobile/CLAUDE.md`, `docs/architecture/state-machines.md` (təsdiq qaydaları).
Backend hazır olana qədər `NEXT_PUBLIC_API_MOCK=1` — `@payproof/mocks`. Real API-yə keçid M-12-dədir.
Ümumi skills: `frontend-ui-engineering`, `frontend-design:frontend-design`, `superpowers:verification-before-completion` (mobil viewport-da real yoxlama).

---

### M-01 · Mobil PWA skeleti
**Branch:** `feat/M-01-mobile-skeleton` · **Asılılıq:** S-08
Əvvəl packages/*/README.md fayllarını oxu — @payproof paketlərini qoşmaq üçün transpilePackages və Tailwind @config qeydləri oradadır.
**Tailwind v4 qeydi:** v4 `node_modules`-dakı (workspace) paketləri class axtarışında skan etmir. `globals.css`-də design-tokens üçün `@source` olmalıdır, yoxsa status badge-lərinin (`badgeClass`) class-ları CSS-ə düşmür: `@source "../../../../packages/design-tokens/src";` (yol CSS faylına nisbətən — vebdəki `apps/web/src/app/globals.css` kimi).
**Daxildir:** Next.js app (`create-next-app` müvəqqəti qovluqda → köçür, `CLAUDE.md` saxlanılsın), TS strict, Tailwind + tokens, viewport meta (`viewport-fit=cover`), safe-area padding-ləri, PWA (Serwist; `manifest.webmanifest`, ikonlar, `theme_color` brand), ESLint/Prettier, Vitest, Playwright (iPhone 13 profili), `src/{app,features,components/ui,lib}`.
**Qəbul:** [ ] `pnpm --filter mobile dev|build|lint|typecheck|test` [ ] Lighthouse PWA "installable" [ ] light/dark
**Commit-lər:** 1) next app 2) tailwind + tokens 3) PWA manifest + SW 4) lint/test config

### M-02 · Data qatı
**Branch:** `feat/M-02-mobile-data` · **Asılılıq:** M-01
**Daxildir:** `lib/api.ts` (`@payproof/api-client`), QueryClient (mobil üçün: `refetchOnWindowFocus`, offline-da keşdən göstərmə), MSW (`NEXT_PUBLIC_API_MOCK=1`), xəta → toast, `useMe()`.
**Qəbul:** [ ] mock rejimində `/v1/me` və `/v1/packages` gəlir

### M-03 · Mobil UI dəsti
**Branch:** `feat/M-03-mobile-ui-kit` · **Asılılıq:** M-02
**Daxildir:** `AppHeader` (sticky, geri düyməsi), `TabBar` (Əsas, Paketlər, Bildirişlər + sayğac, Profil), `BottomSheet` (focus trap, Esc, swipe-down — sadə), `ListItem`, `Chip` (`aria-pressed`), `Card`, `Banner`, `Skeleton`, `EmptyState`, status badge-ləri (`@payproof/api-client/i18n`), `Toast`. Toxunma sahəsi ≥ 44×44.
**Qəbul:** [ ] hər komponentin testi [ ] VoiceOver/TalkBack üçün label-lar

### M-04 · Giriş, sessiya, profil
**Branch:** `feat/M-04-login-profile` · **Asılılıq:** M-03
**Daxildir:** Giriş ekranı (brand hero, "Sintetik məlumatlarla demo", demo hesab seçimi: Rəşad — təsdiqçi default, Aygün, Kamran; `POST /auth/dev-login`), sessiya saxlanması, route guard (girişdən sonra istənilən səhifəyə qayıtmaq), Profil (ad, vəzifə, rol, şirkət, səlahiyyətlər `GET /v1/me`-dən Bəli/Xeyr, Dil — "Tezliklə", Push — "P2", Görünüş — sistem, Veb tətbiqə keç, Hesabdan çıx).
**Qəbul:** [ ] çıxışdan sonra keş təmizlənir

### M-04b · Canlı yeniləmələr
**Branch:** `feat/M-04b-live-updates` · **Asılılıq:** M-04, S-09 · **Skills:** `superpowers:test-driven-development`
**Məqsəd:** ADR-0010 — vebdə edilən dəyişiklik (məs. operatorun düzəlişi, ixrac) mobildə refresh-siz, ≤ 2 s-də görünsün.
**Daxildir:**
- `lib/live.ts`: `useLiveUpdates()` — girişdən sonra app layout-unda bir dəfə qoşulur (`subscribeEvents`), çıxışda/401-də dayanır
- invalidate xəritəsi (`LiveEventType` → mobil query key-ləri: Əsas ekran, paketlər, `detail(package_id)`, bildirişlər + tab bar sayğacı); bilinməyən tip və (yenidən) qoşulma → bütün keş; testlə örtülmüş təmiz funksiya
- mobil davranış: `visibilitychange` gizli → axın bağlanır, görünən → yenidən qoşulma + tam refetch; offline-da qoşulmur (M-11 offline rejimi ilə uyğun)
- "kim dəyişdi" toast-u (M-03 `Toast`; öz hadisəsi üçün yox) və `usePackageChangedSince(packageId, version)` + `Banner` — açıq vərəqədə (M-08/M-09 təsdiq vərəqəsi istifadə edir) "Başqa istifadəçi paketi yenilədi (vN)…" + təsdiq bağlanır
- ehtiyat polling: axın qırıq ikən 30 s, bərpada dayanır
**Daxil deyil:** Web Push (P2, M-13), bağlantı statusu indikatoru, təsdiq vərəqəsinin özü (M-09).
**Qəbul meyarları:**
- [ ] İki tab (mock, eyni origin `:3001`): bir tab-da dəyişiklik → digərində ≤ 2 s-də refresh-siz + toast
- [ ] Fona keçib qayıdanda axın yenidən qoşulur və məlumat yenilənir (Vitest, `visibilitychange`)
- [ ] Axın kəsiləndə 30 s polling işləyir, bərpada dayanır
**Commit planı:** 1) invalidate xəritəsi + testlər 2) `useLiveUpdates` + layout 3) visibility/offline davranışı 4) toast + `usePackageChangedSince` 5) ehtiyat polling

### M-05 · Əsas ekran
**Branch:** `feat/M-05-home` · **Asılılıq:** M-04
**Daxildir:** salamlama + tarix, "Təsdiqinizi gözləyir" hero kartı (say + valyuta üzrə məbləğ; operator üçün "Təsdiqçini gözləyir"), 4 status kartı (klik → paketlər filtrli), açıq problemli məbləğ (AZN/USD ayrıca + "itki deyil"), təsdiq gözləyənlər siyahısı, son fəaliyyət; skeleton, boş vəziyyət.
**Qəbul:** [ ] rəqəmlər veb dashboard ilə eynidir (mock)

### M-06 · Paketlər siyahısı
**Branch:** `feat/M-06-packages` · **Asılılıq:** M-05
**Daxildir:** axtarış, status çipləri (Hamısı, Təsdiq gözləyir, Problemli, Hazır, İxrac edilib — saylarla), siyahı elementi (nömrə, məbləğ, müştəri, versiya, status, bloklayan sayı), "yenilə" (pull-to-refresh və ya düymə + skeleton), boş vəziyyət.
**Qəbul:** [ ] filtr URL-də saxlanılır [ ] 390 px-də üfüqi scroll yoxdur

### M-07 · Paket detalı
**Branch:** `feat/M-07-package-detail` · **Asılılıq:** M-06
**Daxildir:** xülasə kartı (məbləğ, status, versiya, qayda dəsti, tarix, cari təsdiq), sifariş seçilməyibsə xəbərdarlıq + "Vebdə aç", yoxlamalar siyahısı (ikon + başlıq + nəticə), sənədlər siyahısı ("Baxılıb" nişanı), açıq tapşırıqlar (yalnız baxış), alt CTA zonası — 5 vəziyyət: təsdiq düyməsi (approver + READY), "Təsdiqçi gözlənilir", "Təsdiq mümkün deyil: N bloklayan problem" + Vebdə aç, "Veb tətbiqdə ixrac et", "İxrac edilib"/"Emal olunur".
**Qəbul:** [ ] 14 paketin hamısı açılır [ ] CTA vəziyyətləri rol və statusa görə düzgün

### M-08 · Sübut və sənəd vərəqələri
**Branch:** `feat/M-08-evidence-sheets` · **Asılılıq:** M-07
**Daxildir:** yoxlama bottom sheet-i (nəticə, mesaj, mənbə istinadları, "düzəliş vebdə edilir" qeydi), sənəd bottom sheet-i (react-pdf mobil, vurğulama və ya səhifə + sitat; skan xəbərdarlığı; mock-da HTML kağız render), sheet-lər arası "Geri", **baxılmış sənədlərin izlənməsi** (paket versiyasına bağlı — versiya dəyişəndə sıfırlanır).
**Qəbul:** [ ] versiya dəyişəndə "baxılıb" statusu sıfırlanır

### M-09 · Təsdiq axını
**Branch:** `feat/M-09-approval` · **Asılılıq:** M-08 · **Skills:** `security-and-hardening` (idempotentlik, 409)
**Daxildir:** təsdiq vərəqəsi (versiya, qayda dəsti, yoxlama xülasəsi; 1) hər sənədə bax — hamısı baxılmayınca qeyd bağlıdır; 2) "Cari vN versiyasının sənədlərinə və yoxlama nəticələrinə baxdım"; "bank ödənişinə səlahiyyət vermir" qeydi), `POST /approve` (`expected_version`, `Idempotency-Key`), 409 → "Paket yenilənib, yenidən baxın" + məlumatı yenilə, 403 → izah, uğur ekranı ("Paket göndərilməyə hazırdır", "…-lik faktura paketi…", "ödəniş zəmanəti deyil", təsdiq detalları, "Veb tətbiqdə ixrac et", "Ana səhifəyə qayıt").
**Qəbul:** [ ] sənədlərə baxmadan təsdiq mümkün deyil [ ] iki dəfə basmaq bir təsdiq yaradır [ ] təsdiqdən sonra mobilin öz Əsas ekranı, siyahısı və detalı dərhal yenilənir. Qeyd: mock rejimində veb (`:3000`) və mobil (`:3001`) **ayrı mock bazalarıdır** (ayrı origin — ADR-0010); mobil təsdiqin vebdə görünməsi M-12 və I-01-də real API ilə yoxlanır

### M-10 · Bildirişlər
**Branch:** `feat/M-10-notifications` · **Asılılıq:** M-07
**Daxildir:** "Yeni" və "Əvvəlki" qrupları, oxunmamış nöqtəsi, klik → oxundu + paketə keçid, "Hamısını oxu", tab bar sayğacı, "Push P2-dir" qeydi.

### M-11 · PWA və keyfiyyət keçidi
**Branch:** `feat/M-11-pwa-quality` · **Asılılıq:** M-09, M-10 · **Skills:** `browser-testing-with-devtools` və ya `playwright-cli`
**Daxildir:** "Ana ekrana əlavə et" ipucu, offline: son baxılan siyahı/detal keşdən (yalnız oxuma; təsdiq offline mümkün deyil — aydın mesaj), dark mode, a11y (axe), 360/390/430 px yoxlaması, Playwright e2e (mock): giriş → INV-1038 → sənədlərə bax → təsdiq → uğur; operator üçün təsdiq yoxdur; bloklanmış paket.
**Qəbul:** [ ] e2e CI-da yaşıl [ ] offline-da təsdiq düyməsi aydın şəkildə bağlıdır

### M-12 · Real API-yə keçid
**Branch:** `feat/M-12-real-api` · **Asılılıq:** M-11, B-12b, B-20, B-23
**Daxildir:** `NEXT_PUBLIC_API_MOCK=0`, real dev-login, real fayl linkləri (imzalı URL), fərqlərin düzəldilməsi (müqavilə pozuntusu → `/contract-change` — lead ilə), e2e real stack-də.
**Qəbul:** [ ] mobil təsdiq → veb-də `APPROVED_READY` (real API) refresh-siz, ≤ 2 s-də (SSE) [ ] vebdəki dəyişiklik mobildə ≤ 2 s-də görünür

---
**Gələcək (P2, indi etmə):** M-13 Web Push bildirişləri · anbar üçün kamera ilə təhvil aktı yükləmə (brifdə yoxdur — əvvəl validasiya).
