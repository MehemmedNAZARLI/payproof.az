# Progress — Mobile (M)

Sahib: mobil komanda yoldaşı · Step təfərrüatları: `docs/roadmap/steps/mobile.md`
Status: ⬜ başlanmayıb · 🟡 icrada · ✅ bitib (merge olunub) · 🚧 bloklanıb (səbəbi qeyddə)

Bu faylı yalnız bu track-in sessiyası yeniləyir (`/step` başlayanda 🟡, `/finish-step`-də ✅).

| Step | Ad | Status | Branch | Tarix | Qeyd |
|---|---|---|---|---|---|
| M-01 | Mobil PWA skeleti | ✅ | `claude/elegant-thompson-4x8c77` | 2026-11-08 | Next 16 + Serwist (Turbopack); installable CDP ilə yoxlanır (Lighthouse 12-də PWA yoxdur); S-08 ⬜ ikən istifadəçi qərarı ilə; sessiya branch-ı (feat/ əvəzinə); hələ merge olunmayıb |
| M-02 | Data qatı | ✅ | `claude/mobile-m03-m02-r7mq0y` | 2026-11-08 | Mock səhifədaxili (MSW `getResponse`, SW yox); S-05/S-06 yoxdur → `apps/mobile`-da shortcut-lar (client, format, i18n, fixtures store; statuslar `expected.json`-dan); tiplər `openapi.yaml`-dan generasiya (gitignore); token yoxdursa mock default təsdiqçi (M-04-ə qədər); mock dəstəkləmədiyi filtrlərə 422 verir; hələ merge olunmayıb |
| M-03 | Mobil UI dəsti | ✅ | `claude/mobile-m03-m02-r7mq0y` | 2026-11-08 | M-02-dən əvvəl (istifadəçi qərarı); iri başlıq, blur bar-lar, yay fizikalı sheet, shimmer, toast; önizləmə `/kit` (yalnız mock); tab route-ları M-04…M-10-da — o vaxta qədər prefetch 404 verir; hələ merge olunmayıb |
| M-04 | Giriş, sessiya, profil | ✅ | `claude/mobile-screens-m04-m06-ddguv8` | 2026-11-08 | Bir toxunuşla demo giriş; sessiya localStorage-da (vaxtında bitir, tablar arası izlənir); `?next=` yalnız tətbiqdaxili; çıxış/istifadəçi dəyişməsi Query keşini və SW runtime keşlərini (precache-dən başqa) silir — e2e ilə yoxlanır; mock tokensiz sorğuya 401; M-04…M-06 bir sessiya branch-ında (istifadəçi qərarı); hələ merge olunmayıb |
| M-05 | Əsas ekran | ✅ | `claude/mobile-screens-m04-m06-ddguv8` | 2026-11-08 | Mock `/v1/dashboard` müqavilə nümunəsi və `expected.json` ilə golden test (veb W-06 eyni endpoint-i oxuyur); "Son fəaliyyət" mock `/v1/audit`-dən (tarixçə fixtures-dan törədilir — S-06 əvəz edəcək); bildiriş sayğacı M-10-da; hələ merge olunmayıb |
| M-06 | Paketlər siyahısı | ✅ | `claude/mobile-screens-m04-m06-ddguv8` | 2026-11-08 | Filtr və axtarış URL-də (`?status=&q=`); çip sayları dashboard-dan; düymə ilə yeniləmə (pull-to-refresh yox); 100 paketdən sonra səhifələmə yoxdur; `/packages/[id]` və `/notifications` M-07/M-10-a qədər yer tutucu; hələ merge olunmayıb |
| M-07 | Paket detalı | ✅ | `claude/dazzling-ride-l4qka6` | 2026-11-08 | Mock `GET /v1/packages/{id}` fixtures-dan + prototipin `runChecks` portu (mesaj və sübut üçün; 9 qaydanın nəticəsi `expected.json` ilə golden test), hər cavab `openapi.yaml`-a qarşı Ajv ilə yoxlanır; `fields`/`comparison` mock-da boşdur (veb üçündür); CTA 7 vəziyyət (`cta.ts`), icazə serverin `permissions`-ından; "Sübutlara baxıb təsdiqlə" hələlik toast (M-09); M-07 və M-08 bir sessiya branch-ında (istifadəçi qərarı); hələ merge olunmayıb |
| M-08 | Sübut və sənəd vərəqələri | ✅ | `claude/dazzling-ride-l4qka6` | 2026-11-08 | Bir sheet: yoxlama → sitat edilən sənəd (vurğu) → Geri (slayd + hündürlük morph); mock-da `mock:paper/<version>` linki → HTML kağız, real API-də react-pdf (bbox) / skan şəkli / cədvəl üçün "Faylı aç"; pinch, double-tap, ctrl+wheel, ± düymələri; landşaftda sənəd tam ekran; baxılma sessionStorage-da istifadəçi + paket versiyası ilə (versiya dəyişəndə sıfırlanır — unit test; mock read-only olduğundan e2e-də versiya dəyişmir); PDF yolu `/kit`-də generasiya olunan PDF ilə e2e-də yoxlanır; hələ merge olunmayıb |
| M-09 | Təsdiq axını | ⬜ | | | |
| M-10 | Bildirişlər | ⬜ | | | |
| M-11 | PWA və keyfiyyət keçidi | ⬜ | | | SW yeniləmə ipucu (`skipWaiting` əvəzinə); manifest teal ↔ meta theme-color keçidi; dark splash |
| M-12 | Real API-yə keçid | ⬜ | | | |
