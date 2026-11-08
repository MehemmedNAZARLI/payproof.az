# Prompt-lar — mobil komanda yoldaşı (Mobile track, M-01 … M-12)

Sizin işiniz: `apps/mobile` — təsdiqçi üçün PWA (status izləmə + sübuta baxıb təsdiq). Backend-i və vebi lead qurur; siz onları gözləmirsiniz — `@payproof/mocks` eyni API-ni təqlid edir. Real API-yə keçid M-12-dədir.

## Quraşdırma (bir dəfə)
```bash
git clone <repo-url> payproof && cd payproof
./scripts/setup.sh          # git hook-ları + alət yoxlaması
pnpm install
```
Prototipi brauzerdə açın: `docs/product/prototype/payproof-prototype.html` → yuxarıdan **Mobil tətbiq** → "Demonu başlat" düyməsi ilə axına baxın. Qurduğunuz ekranlar buna bənzəməlidir.

## 0. İlk sessiya
```
Mən PayProof-un mobil track-ində işləyirəm. CLAUDE.md, apps/mobile/CLAUDE.md, docs/architecture/adr/0002-mobile-pwa.md, docs/architecture/state-machines.md və docs/roadmap/steps/mobile.md fayllarını oxu.
Mənə qısa izah et: mobildə kim üçün nə qurulur, nə qurulmur, hansı paylaşılan paketlərdən istifadə edirəm və M-01 … M-12 ardıcıllığı. Hələ heç nə dəyişmə.
```
Sonra:
```
/next-step mobile
```

## 1. Hər step
```
/step M-0X
```
Claude: branch yaradır (`feat/M-0X-…`), plan qurur, kiçik commit-lərlə (≤200 sətir) işləyir, sonda `/finish-step` icra edir. PR açılanda lead-ə xəbər verin (və ya özünüz CI yaşıl olandan sonra merge edin — razılaşmaya görə).

## 2. Gündəlik başlanğıc
```
/sync
/status
```
```
Mobil track-də harada qaldıq? docs/progress/mobile.md və git log-a bax; 🟡 step varsa qalan commit planını göstər və davam et.
```

## 3. Faydalı prompt-lar
**Ekranı prototipə uyğunlaşdır:**
```
docs/product/prototype/payproof-prototype.html faylında mobil <ekran adı> ekranının (mHome/mPackages/mPackage/sheetHTML/mSuccess funksiyaları) mətnlərinə, bölmələrinə və vəziyyətlərinə bax. Bizim komponenti onlara uyğunlaşdır — dizayn tokenləri ilə, 44px toxunma sahəsi ilə.
```
**Mobil viewport-da yoxla:**
```
Dev server-i aç (pnpm --filter mobile dev), 390x844 viewport-da <ekran>-ı yoxla: üfüqi scroll, toxunma sahələri, light/dark, konsol xətaları. Problemləri kiçik commit-lərlə düzəlt.
```
**Paylaşılan paketdə (mocks/api-client) problem var:**
```
Bu problem packages/<paket>-dədir və mənim track-imə aid deyil. Problemi, təkrar etmə addımlarını və təklif olunan düzəlişi qısa mətn kimi yaz ki, lead-ə göndərim. Paketi dəyişmə.
```
**API-də lazım olan sahə yoxdur:**
```
/contract-change <nə lazımdır və niyə>
```
(PR-ı lead nəzərdən keçirir.)
**Hook commit-i rədd etdi:**
```
Pre-commit 200 sətir limitini keçdi. Dəyişikliyi məntiqi hissələrə böl (git add -p) və ayrı commit et. --no-verify istifadə etmə.
```

## 4. Step sonu
```
/finish-step M-0X
```

## 5. Real API (M-12) — lead B-20 və B-23-ü bitirəndən sonra
```
docker compose və backend-i qaldırmaq üçün README-dəki əmrləri göstər, sonra contract-guardian subagent-i ilə mobil istifadə etdiyi endpoint-lərdə mock ↔ real fərqlərini yoxla. Sonra /step M-12.
```

## Qaydalar (qısa)
- Yalnız `apps/mobile/` və `docs/progress/mobile.md`-yə yazırsınız.
- Hər step ayrıca branch; `main`-ə birbaşa push yoxdur.
- Commit: `feat(M-07): add package checks list` — kiçik, test keçir.
- Mobildə yükləmə, düzəliş, tapşırıq, ixrac **yoxdur** — "Vebdə aç".
- Təsdiq: bütün sənədlərə baxılmayınca və "baxdım" qeydi olmadan mümkün deyil.
