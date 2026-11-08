# fixtures/ — sintetik demo dataset

Backend seed (B-09), MSW mock-lar (S-06) və golden testlər **eyni** fayllardan istifadə edir. Mənbə: `docs/product/prototype/payproof-prototype.html` (JS sabitləri və qayda mühərriki), təsvir: `docs/product/demo-dataset.md`.

Yoxlama: `pnpm fixtures:check` — hər fayl `schema/*.json`-a uyğundur, referanslar bütövdür, cəmlər qəpiklə yenidən hesablanır, `expected.json` `demo-dataset.md` cədvəli ilə tutuşdurulur.

Generasiya: `pnpm fixtures:generate` — `scripts/fixtures/generate.mjs` prototipin JS məlumatlarını və qayda mühərrikini node-da işlədib bütün `fixtures/*.json` fayllarını (o cümlədən `expected.json`) yenidən yazır, Prettier ilə formatlayır və `fixtures:check` işlədir. Nəticə deterministikdir: prototip dəyişməyibsə diff boş olur.
- **Nə vaxt:** yalnız prototip (`docs/product/prototype/payproof-prototype.html`) məlumatı və ya mühərriki dəyişəndə, ya da fixture formatı dəyişəndə (generator + `schema/` birlikdə).
- **Nə vaxt yox:** test keçsin deyə — `expected.json` golden məlumatdır.
- Generasiyadan sonra `git diff fixtures/` diqqətlə nəzərdən keçirilir; dəyişiklik ayrıca `fix(S-03)` commit-i və səbəbi ilə gedir.

## Konvensiyalar
- **Pul** — string, 2 onluq (`"9.00"`), həmişə `currency` ilə. Heç vaxt float deyil; validator tam qəpiklə (BigInt) hesablayır. AZN və USD bir cəmdə toplanmır.
- **Tarix** — `YYYY-MM-DD`; **vaxt** — RFC 3339, Bakı vaxtı (`2026-11-03T09:12:00+04:00`). Demo "bu gün": `expected.demo_now`.
- **ID-lər** — prototipdəki sabit slug-lar (`u1`, `c1`, `pkg_1042`, `PO-381`, `T-118`). Seed bunları UUID-yə xəritələyir; insan oxuyan nömrələr (`INV-…`, `T-…`) olduğu kimi qalır.
- **`sha256`** — sintetikdir: demo faylların baytı yoxdur, ona görə fayl adının sha256-sıdır. Dublikat yoxlaması paket daxilində bu dəyəri müqayisə edir (`INV-1042.pdf` təkrar yükləmə → v1 ilə eyni).
- **E-poçt** — `@a-distribusiya.test` (qəsdən mövcud olmayan domen).
- `order_link.confirmed_by: "system"` — dəqiq PO ilə avtomatik əlaqə (`method: exact_id`); istifadəçi ID-si — insan təsdiqi (`human`).

## `expected.json`
Prototipin öz mühərriki (`runChecks`/`info`) ilə hesablanıb: hər paket üçün status, bütün qayda nəticələri, əsas (kaskad olmayan) bloklayanlar, R-005 fərqi; dashboard dəyərləri; INV-1042 axını addım-addım (prototipin demo turu ilə eyni ardıcıllıq); yeni dəstlərin gözlənilən statusu.
Golden test keçsin deyə dəyişdirilmir — fixture səhvdirsə ayrıca `fix(S-03)` commit-i və səbəbi.

## Qəsdən daxil edilməyənlər
- **Audit tarixçəsi**, `problem_since`, `updated_at`, `cached_status` — törədilən məlumatdır. Prototip bunları `reset()`-də fixtures-dan qurur; seed və mock store eyni qaydanı tətbiq edir (paket yaradıldı → sənədlər → çıxarış → əlaqə → təsdiq/ixrac → yoxlama). `problem_since` = problemli paketin yaradılma tarixi.
- **Fayl baytları** — `AI_PROVIDER=mock` rejimində çıxarış nəticəsi `samples.json`/`packages.json`-dakı strukturdan gəlir.
