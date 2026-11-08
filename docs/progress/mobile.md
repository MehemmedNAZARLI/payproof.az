# Progress — Mobile (M)

Sahib: mobil komanda yoldaşı · Step təfərrüatları: `docs/roadmap/steps/mobile.md`
Status: ⬜ başlanmayıb · 🟡 icrada · ✅ bitib (merge olunub) · 🚧 bloklanıb (səbəbi qeyddə)

Bu faylı yalnız bu track-in sessiyası yeniləyir (`/step` başlayanda 🟡, `/finish-step`-də ✅).

| Step | Ad | Status | Branch | Tarix | Qeyd |
|---|---|---|---|---|---|
| M-01 | Mobil PWA skeleti | ✅ | `claude/elegant-thompson-4x8c77` | 2026-11-08 | Next 16 + Serwist (Turbopack); installable CDP ilə yoxlanır (Lighthouse 12-də PWA yoxdur); S-08 ⬜ ikən istifadəçi qərarı ilə; sessiya branch-ı (feat/ əvəzinə); hələ merge olunmayıb |
| M-02 | Data qatı | ⬜ | | | Bir scope-da bir SW: Serwist `/`-u tutur → mock rejimində MSW browser worker yox, sorğular səhifədaxili həll olunsun (msw `getResponse` və ya interceptors); `onlineManager` reconnect refetch |
| M-03 | Mobil UI dəsti | 🟡 | `claude/mobile-m03-m02-r7mq0y` | | Sıra: M-01 → M-03 → M-02 (istifadəçinin qərarı; roadmap-də M-03 M-02-dən asılıdır) |
| M-04 | Giriş, sessiya, profil | ⬜ | | | Çıxışda Query keşi ilə yanaşı `caches.delete()` (SW runtime keşləri) |
| M-05 | Əsas ekran | ⬜ | | | |
| M-06 | Paketlər siyahısı | ⬜ | | | |
| M-07 | Paket detalı | ⬜ | | | |
| M-08 | Sübut və sənəd vərəqələri | ⬜ | | | |
| M-09 | Təsdiq axını | ⬜ | | | |
| M-10 | Bildirişlər | ⬜ | | | |
| M-11 | PWA və keyfiyyət keçidi | ⬜ | | | SW yeniləmə ipucu (`skipWaiting` əvəzinə); manifest teal ↔ meta theme-color keçidi; dark splash |
| M-12 | Real API-yə keçid | ⬜ | | | |
