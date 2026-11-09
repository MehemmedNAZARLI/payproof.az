# Web track (W) — `apps/web`

**Sahib:** lead · **İstifadəçilər:** operator, təsdiqçi, auditor (masaüstü, 1024–1440 px; 768-də işləyir).
**Stack:** Next.js (App Router) + TypeScript strict, Tailwind + `@payproof/design-tokens` preset, shadcn/ui (Radix), TanStack Query + Table, react-hook-form + zod, react-pdf, Recharts, Vitest + Testing Library, Playwright.
**Vizual və mətn mənbəyi:** `docs/product/prototype/payproof-prototype.html` (Veb tətbiq görünüşü). Oxu: `apps/web/CLAUDE.md`.
Backend hazır olana qədər `NEXT_PUBLIC_API_MOCK=1` — `@payproof/mocks`.
Ümumi skills: `frontend-ui-engineering`, `frontend-design:frontend-design`, `superpowers:test-driven-development` (hook/helper-lər üçün), `superpowers:verification-before-completion` (brauzerdə real yoxlama).

---

### W-01 · Next.js skeleti
**Branch:** `feat/W-01-web-skeleton` · **Asılılıq:** S-08
Əvvəl packages/*/README.md fayllarını oxu — @payproof paketlərini qoşmaq üçün transpilePackages və Tailwind @config qeydləri oradadır.
**Daxildir:** Next.js app (`create-next-app` boş olmayan qovluqda işləmir — müvəqqəti qovluqda yaradıb köçür, `CLAUDE.md` saxlanılsın), TS strict, Tailwind + tokens preset, `tokens.css` import, sistem şrift stack-i, shadcn/ui init (Radix), ESLint + Prettier, Vitest + RTL, Playwright config, `src/{app,features,components/ui,lib}` quruluşu, `lang="az"`.
**Qəbul:** [ ] `pnpm --filter web dev|build|lint|typecheck|test` işləyir [ ] light/dark tokenlər tətbiq olunur
**Commit-lər:** 1) next app 2) tailwind + tokens 3) shadcn init 4) eslint/prettier 5) vitest + playwright

### W-02 · Data qatı və dev auth
**Branch:** `feat/W-02-data-layer` · **Asılılıq:** W-01
**Daxildir:** `lib/api.ts` (`createApiClient`, token), `QueryClientProvider`, query key factory konvensiyası, MSW browser worker (`NEXT_PUBLIC_API_MOCK=1`), qlobal xəta → toast (sonner), `ApiError` mesajlarının göstərilməsi, dev auth: demo istifadəçi seçimi (`POST /auth/dev-login`), token saxlanması (memory + sessionStorage try/catch), `useMe()` (səlahiyyətlər `GET /v1/me`-dən).
**Qəbul:** [ ] mock rejimində `/v1/me` cavab verir [ ] 401 → giriş ekranı [ ] səlahiyyət frontend-də hardcode deyil

### W-03 · i18n və status komponentləri
**Branch:** `feat/W-03-status-ui` · **Asılılıq:** W-02
**Daxildir:** `PackageStatusBadge`, `CheckOutcomeBadge`, `TaskStatusBadge`, `DocumentStatusBadge` (ikon + mətn + rəng — yalnız rəng yox), `Money`, `DateTime` komponentləri (`@payproof/api-client/format`), `t` helper-in istifadəsi; Vitest snapshot-ları.
**Qəbul:** [ ] bütün statuslar glossary.md-dəki mətnlərlə

### W-04 · Tətbiq çərçivəsi (shell)
**Branch:** `feat/W-04-app-shell` · **Asılılıq:** W-03
**Daxildir:** yığılan sol sidebar (İcmal, Faktura paketləri, Tapşırıqlar + açıq sayı, Müştəri qaydaları, Audit tarixçəsi; "Tezliklə (P1)": ERP inteqrasiyası, Müqavilə çıxarışı — toast), üst panel (qlobal axtarış → paketlər, bildiriş düyməsi yeri, istifadəçi menyusu: demo hesabına keç, çıxış), <768 px drawer, "Sintetik demo" etiketi, aktiv route vurğusu.
**Qəbul:** [ ] klaviatura ilə tam naviqasiya [ ] 768/1024/1440-da üfüqi scroll yoxdur

### W-05 · Ümumi UI dəsti
**Branch:** `feat/W-05-ui-kit` · **Asılılıq:** W-04
**Daxildir:** `PageHeader`, `Banner` (danger/warning/success/brand/neutral), `EmptyState`, `Skeleton` variantları, `ConfirmDialog` (dağıdıcı əməliyyatlar), `DataTable` (TanStack Table wrapper: sort başlıqları `aria-sort` ilə), `Panel`.
**Qəbul:** [ ] hər komponentin Vitest testi [ ] a11y: dialog focus trap, Esc [ ] toxunma sahəsi: vebdə düymələr 32–40px qala bilər, `@media (pointer: coarse)` altında min 44px (interaktiv elementlər, o cümlədən shadcn `Button` ölçüləri)

### W-05b · Canlı yeniləmələr
**Branch:** `feat/W-05b-live-updates` · **Asılılıq:** W-05, S-09 · **Skills:** `superpowers:test-driven-development`
**Məqsəd:** ADR-0010 — başqa əməkdaşın dəyişikliyi vebdə refresh-siz, ≤ 2 s-də görünsün.
**Daxildir:**
- `lib/live.ts`: `useLiveUpdates()` — `(app)` layout-unda bir dəfə qoşulur (`subscribeEvents`, `@payproof/api-client`), çıxışda/401-də dayanır
- invalidate xəritəsi (`LiveEventType` → query key-lər, mövcud key factory ilə): `package.*` → paket siyahısı, `detail(package_id)`, dashboard, paket auditi; `task.changed` → tapşırıqlar + detal; `notification.created` → bildirişlər; `requirements.changed` → müştərilər + bütün paketlər; bilinməyən tip və (yenidən) qoşulma → bütün keş; testlə örtülmüş təmiz funksiya
- "kim dəyişdi" toast-u (sonner): "Aygün Məmmədova INV-1042 paketini yenilədi (v5)" — ad `GET /v1/users` keşindən, nömrə keşdən (yoxdursa "paketi"); öz hadisələri üçün toast yox; eyni paket üçün ardıcıl hadisələr bir toast-a birləşir
- `usePackageChangedSince(packageId, version)` + `StaleBanner` ("Başqa istifadəçi paketi yenilədi (vN). Davam etmək üçün yenidən baxın." + "Yenilə"): açıq dialoqda (təsdiq, ixrac, düzəliş — W-11/W-13 istifadə edir) cari versiyadan böyük hadisə gələndə göstərilir; təsdiq düyməsi bağlanır (server onsuz da 409 verir)
- ehtiyat polling: axın qırıq ikən aktiv sorğular 30 s-dən bir (`refetchInterval`), bərpa olunanda dayanır
**Daxil deyil:** backend (B-12b), bağlantı statusu indikatoru, push bildirişləri, dialoqların özü (W-11, W-13).
**Qəbul meyarları:**
- [ ] İki tab (mock, eyni brauzer): Rəşad tab-ında təsdiq → Aygün tab-ında siyahı/detal ≤ 2 s-də refresh-siz yenilənir + toast
- [ ] Açıq dialoq zamanı başqa tab paketi dəyişəndə `StaleBanner` görünür
- [ ] Axın kəsiləndə 30 s polling işləyir, bərpada dayanır; yenidən qoşulmada tam refetch (Vitest, fake timers)
- [ ] Öz dəyişikliyi toast göstərmir
**Commit planı:** 1) invalidate xəritəsi + testlər 2) `useLiveUpdates` + layout qoşulması 3) toast (ad/nömrə, birləşdirmə) 4) `usePackageChangedSince` + `StaleBanner` 5) ehtiyat polling + testlər

### W-06 · İcmal (dashboard)
**Branch:** `feat/W-06-dashboard` · **Asılılıq:** W-05
**Daxildir:** məhsul təqdimatı kartı (bağlana bilir), 4 KPI kartı (klik → filtrlənmiş siyahı), açıq problemli məbləğ (valyuta üzrə ayrıca + "maliyyə itkisi deyil" qeydi), ən çox təkrarlanan problem, problemdə qalma müddəti + "vaxt qənaəti ölçülməyib" qeydi, problem növləri bar chart (FAIL/UNKNOWN), status donut (legend klik → filtr), diqqət tələb edən paketlər, təsdiq tarixçəsi; skeleton.
**Qəbul:** [ ] dəyərlər mock-da 29.706,00 AZN / 1.800,00 USD / 3,0 gün [ ] qrafiklərin mətn alternativi var

### W-07 · Paketlər siyahısı
**Branch:** `feat/W-07-packages-list` · **Asılılıq:** W-05
**Daxildir:** cədvəl (faktura №, müştəri, tarix, məbləğ, vəziyyət, bloklayan, məsul, son yenilənmə), axtarış (debounce), filtrlər (status, müştəri, problem növü, məsul, tarix), sıralama, pagination — hamısı URL query-də (geri düyməsi işləyir), boş vəziyyət + "filtrləri təmizlə", sətir klik + klaviatura.
**Qəbul:** [ ] URL-i paylaşanda eyni görünüş [ ] filtrlər mock datası ilə düzgün

### W-08 · Paket detalı I — başlıq, banner-lər, sənədlər, tarixçə
**Branch:** `feat/W-08-package-detail-1` · **Asılılıq:** W-07
**Daxildir:** breadcrumb, başlıq (nömrə, status, versiya, müştəri, məbləğ, qayda dəsti, məsul), əməliyyat düymələri (Yenidən yoxla, Sənəd yüklə, Təsdiqlə/İxrac — vəziyyətə görə), hazırlıq banneri (R-010 — 5 variant), sifariş uyğunlaşdırma banneri, sənədlər və versiyalar paneli (cari + əvvəlki versiyalar, "sənəd yoxdur" ≠ "oxunmadı"), fəaliyyət tarixçəsi; layout: container query ilə 1/2/3 sütun (prototip).
**Qəbul:** [ ] 14 paketin hamısı xətasız açılır [ ] PROCESSING vəziyyəti

### W-09 · Paket detalı II — müqayisə və mənbə göstəricisi
**Branch:** `feat/W-09-compare-evidence` · **Asılılıq:** W-08
**Daxildir:** müqayisə cədvəli (faktura · sifariş · təhvil; fərq xanaları ikon + rəng + mətn; hər xanada "mənbəyə bax"), `EvidenceViewer` dialoqu: react-pdf ilə səhifə, bbox varsa vurğulama, yoxdursa səhifə + sitat (imitasiya yox), köhnə versiya xəbərdarlığı, skan xəbərdarlığı; mock rejimində prototipdəki kimi HTML "kağız" render (PDF yoxdursa).
**Qəbul:** [ ] INV-1044 qiymət xanası vurğulanır, sübut açılır

### W-10 · Paket detalı III — yoxlamalar paneli və əməliyyatlar
**Branch:** `feat/W-10-checks-panel` · **Asılılıq:** W-09
**Daxildir:** say xülasəsi, "Bloklayan problemlər" kartları (mesaj, mənbə linkləri, fix əməliyyatları), "Asılı yoxlamalar" kompakt siyahısı, keçən/NA (bağlı `details`), sifariş seçimi dialoqu (namizədlər, səbəb, faktura önizləməsi, seçim məcburi), imza yoxlaması (viewer + "İmzanın mövcudluğunu təsdiqləyirəm"), "Yenidən yoxla" (loading), mutation-dan sonra query invalidation.
**Qəbul:** [ ] INV-1042: link → NEEDS_FIX; INV-1048: seçim etmədən təsdiq → inline xəta

### W-11 · Çıxarış düzəlişi və yükləmə
**Branch:** `feat/W-11-correction-upload` · **Asılılıq:** W-10
**Daxildir:** "Çıxarışı düzəlt" dialoqu (mənbə önizləmə, yeni dəyər + səbəb validasiyası, "bunun əvəzinə yeni versiya yüklə" linki — iki yolun fərqi aydın), yükləmə dialoqu (sənəd növü, fayl seçimi/drag-drop, mock-da nümunə fayllar, `Idempotency-Key`, mərhələlər: qəbul → emal → çıxarıldı → yoxlandı, job polling, dublikat xəbərdarlığı, 409 versiya konflikti → "yenilə").
**Qəbul:** [ ] INV-1047 PO düzəlişi → READY [ ] dublikat yeni versiya yaratmır

### W-12 · Tapşırıqlar
**Branch:** `feat/W-12-tasks` · **Asılılıq:** W-10
**Daxildir:** "Tapşırıq yarat" dialoqu (məsul — qaydaya görə default, addım şablonu, son tarix ≥ bu gün, şərh), yoxlama kartında mövcud tapşırıq nişanı, Tapşırıqlar səhifəsi (tablar, məsul filtri, "Gecikir"/"Bu gün", İcraya götür, Yoxlamaya göndər — qayda keçməsə xəbərdarlıq, Ləğv et + təsdiq), sidebar sayğacı.
**Qəbul:** [ ] `RESOLVED` düyməsi yoxdur — yalnız sistem

### W-13 · Təsdiq və ixrac
**Branch:** `feat/W-13-approve-export` · **Asılılıq:** W-11
**Daxildir:** təsdiq dialoqu (versiya, qayda dəsti, yoxlama xülasəsi, sənədlər, "baxdım" qeydi məcburi, "ödəniş təsdiqi deyil" qeydi; rol yoxdursa izahlı toast; bloklanıbsa səbəb), `expected_version` + `Idempotency-Key`, 409 → "paket yenilənib" dialoqu; ixrac dialoqu (faktura məcburi, digər sənədlər seçilə bilər, daxili məlumatların daxil olmadığı qeydi, manifest yükləmə), "Manifesti yenidən yüklə", daxili hesabat düyməsi.
**Qəbul:** [ ] operator üçün təsdiq bağlıdır [ ] uğurdan sonra banner "…-lik faktura paketi göndərilməyə hazırdır"

### W-14 · Yeni paket və silmə
**Branch:** `feat/W-14-new-package` · **Asılılıq:** W-11
**Daxildir:** "Yeni paket" dialoqu (müştəri, sənəd dəsti/fayllar, məsul; dublikat faktura xətası), yaradılandan sonra detala keçid + emal vəziyyəti; "Paketi sil" (yalnız icazə varsa, təsdiq dialoqu).

### W-15 · Müştəri qaydaları
**Branch:** `feat/W-15-customer-rules` · **Asılılıq:** W-05
**Daxildir:** müştəri kartları (cari qayda dəsti, switch-lər, tolerans, səbəb, versiya tarixçəsi), yalnız approver saxlaya bilir (digərlərinə izah), validasiya, uğurdan sonra əlaqəli paketlərin yenidən yoxlandığı mesajı; "Müqavilədən qayda namizədi — P1" kartı.

### W-16 · Audit və bildirişlər
**Branch:** `feat/W-16-audit-notifications` · **Asılılıq:** W-05
**Daxildir:** Audit səhifəsi (axtarış, istifadəçi filtri, paket linkləri, versiya nişanı, CSV yüklə), bildiriş popover-i (oxunmamış sayı, klik → paket, hamısını oxu).

### W-17 · Keyfiyyət keçidi + E2E
**Branch:** `feat/W-17-quality-e2e` · **Asılılıq:** W-13, W-14, W-15, W-16 · **Skills:** `browser-testing-with-devtools` və ya `playwright-cli`
**Daxildir:** a11y auditi (axe), dark mode, 768/1024/1440 yoxlaması, Playwright e2e (mock ilə): INV-1042 tam axını (operator + approver), INV-1047 düzəliş, INV-1048 namizəd seçimi, icazə ssenariləri; konsolda xəta yoxdur.
**Qəbul:** [ ] e2e CI-da yaşıl

### W-18 · Real API-yə keçid
**Branch:** `feat/W-18-real-api` · **Asılılıq:** W-17, B-24
**Daxildir:** `NEXT_PUBLIC_API_MOCK=0` ilə bütün ekranların backend-ə qarşı yoxlanması, mock ilə real cavab arasındakı fərqlərin düzəldilməsi (müqavilə pozuntusudursa → `/contract-change`), real PDF viewer, e2e-nin real stack-də işləməsi (docker compose + seed).
**Qəbul:** [ ] e2e real API ilə yaşıl
