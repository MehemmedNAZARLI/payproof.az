# ADR-0002: Mobil tətbiq — ayrıca Next.js PWA (native yox)
**Status:** qəbul edilib · 2026-11-08

**Kontekst:** Brif §13.8: əsas məhsul vebdir; mobil görünüş rəhbərin status və təsdiqi üçündür; native tətbiq P0 deyil. Mobil hissəni ayrıca komanda üzvü qurur.

**Qərar:** `apps/mobile` — ayrıca Next.js tətbiqi, mobil-first, PWA (manifest + service worker, Serwist). `packages/api-client`, `packages/mocks`, `packages/design-tokens` veblə paylaşılır. Funksionallıq: giriş, əsas, paketlər, paket detalı, sübut, təsdiq, nəticə, bildirişlər, profil. Düzəliş/yükləmə/tapşırıq mobildə yoxdur ("Vebdə aç").

**Niyə ayrıca app (veb daxilində route yox):** mobil komanda üzvü müstəqil branch-larda işləyir, deploy və performans büdcəsi ayrıdır, konflikt azdır.

**Alternativ:** React Native (Expo). Ehtiyac sübut olunarsa `apps/mobile` əvəzlənir; api-client tipləri və tokenlər qalır.

**Nəticələr:** + bir dil/stack; + quraşdırma yoxdur (link ilə açılır). − push bildirişi P2 (Web Push); native kamera inteqrasiyası yoxdur.
