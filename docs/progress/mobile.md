# Progress — Mobile (M)

Sahib: mobil komanda yoldaşı · Step təfərrüatları: `docs/roadmap/steps/mobile.md`
Status: ⬜ başlanmayıb · 🟡 icrada · ✅ bitib (merge olunub) · 🚧 bloklanıb (səbəbi qeyddə)

Bu faylı yalnız bu track-in sessiyası yeniləyir (`/step` başlayanda 🟡, `/finish-step`-də ✅).

| Step | Ad | Status | Branch | Tarix | Qeyd |
|---|---|---|---|---|---|
| M-01 | Mobil PWA skeleti | ✅ | `claude/elegant-thompson-4x8c77` | 2026-11-08 | Next 16 + Serwist (Turbopack); installable CDP ilə yoxlanır (Lighthouse 12-də PWA yoxdur); S-08 ⬜ ikən istifadəçi qərarı ilə; sessiya branch-ı (feat/ əvəzinə); hələ merge olunmayıb |
| M-02 | Data qatı | ✅ | `claude/mobile-m03-m02-r7mq0y` | 2026-11-08 | Mock səhifədaxili (MSW `getResponse`, SW yox); S-05/S-06 yoxdur → `apps/mobile`-da shortcut-lar (client, format, i18n, fixtures store; statuslar `expected.json`-dan); tiplər `openapi.yaml`-dan generasiya (gitignore); token yoxdursa mock default təsdiqçi (M-04-ə qədər); mock dəstəkləmədiyi filtrlərə 422 verir; hələ merge olunmayıb |
| M-03 | Mobil UI dəsti | ✅ | `claude/mobile-m03-m02-r7mq0y` | 2026-11-08 | M-02-dən əvvəl (istifadəçi qərarı); iri başlıq, blur bar-lar, yay fizikalı sheet, shimmer, toast; önizləmə `/kit` (yalnız mock); tab route-ları M-04…M-10-da — o vaxta qədər prefetch 404 verir; hələ merge olunmayıb |
| M-04 | Giriş, sessiya, profil | 🟡 | `claude/mobile-screens-m04-m06-ddguv8` | 2026-11-08 | Çıxışda Query keşi ilə yanaşı `caches.delete()` (SW runtime keşləri) |
| M-05 | Əsas ekran | 🟡 | `claude/mobile-screens-m04-m06-ddguv8` | 2026-11-08 | |
| M-06 | Paketlər siyahısı | 🟡 | `claude/mobile-screens-m04-m06-ddguv8` | 2026-11-08 | |
| M-07 | Paket detalı | ⬜ | | | |
| M-08 | Sübut və sənəd vərəqələri | ⬜ | | | |
| M-09 | Təsdiq axını | ⬜ | | | |
| M-10 | Bildirişlər | ⬜ | | | |
| M-11 | PWA və keyfiyyət keçidi | ⬜ | | | SW yeniləmə ipucu (`skipWaiting` əvəzinə); manifest teal ↔ meta theme-color keçidi; dark splash |
| M-12 | Real API-yə keçid | ⬜ | | | |
