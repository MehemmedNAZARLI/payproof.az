# Kod standartları

## Ümumi (clean code, scale olunan)
- Ən sadə işləyən həll. Lazımsız abstraksiya, "gələcək üçün" kod, istifadə olunmayan parametr yoxdur.
- Fayl ≤ 300 sətir, funksiya ≤ 40 sətir, komponent ≤ 150 sətir. Böyüyürsə — böl.
- Ad-lar ingiliscə və mənalı; domen terminləri `docs/product/glossary.md`-dəki kimi.
- Şərh yalnız "niyə"ni izah edir. Məhdudiyyəti olan qısa yol: `# shortcut: <limit>, <nə vaxt yenilənməli>`.
- Xəta udulmur: ya idarə olunur, ya da yuxarı ötürülür. Boş `except`/`catch` yoxdur.
- Konfiqurasiya env-dən; sehrli rəqəm yox — adlı sabit.
- Asılılıq əlavə etmək: əvvəl standart kitabxana və mövcud paketlər. Yeni paket — commit mesajında səbəb.

## Python (`apps/api`)
- Python 3.12, `uv`. `ruff` (lint + format), `mypy --strict`, `pytest`.
- Qatlar: `api/` (router — nazik) → `services/` (use-case, tranzaksiya, audit) → `domain/` (təmiz, I/O yoxdur) ; `repositories/` (SQLAlchemy). Router-də biznes məntiqi və SQL yoxdur.
- Pydantic v2 — yalnız HTTP sərhədində (`schemas/`). Domen `@dataclass(frozen=True)` / value object-lərdir.
- SQLAlchemy 2.0 typed (`Mapped[...]`), async session (`asyncpg`). Hər sorğu tenant filtri ilə (base repository).
- Pul `Money(Decimal, currency)`; `float` istifadəsi qadağandır (ruff qaydası ilə tutulur: `flake8-*`/custom grep CI-da).
- Xətalar: domen xətaları (`DomainError` alt sinifləri) → bir exception handler → standart xəta formatı.
- Paket quruluşu: `apps/api/src/payproof/{api,services,domain,repositories,schemas,extraction,storage,worker,core}`.

## TypeScript (`apps/web`, `apps/mobile`, `packages/*`)
- `strict: true`, `noUncheckedIndexedAccess`. `any` qadağandır (`unknown` + daraltma).
- ESLint (next + typescript-eslint) + Prettier. Import sırası avtomatik.
- Feature-first quruluş: `src/features/<feature>/{components,hooks,api.ts,index.ts}`. Route faylları nazikdir.
- Server state: TanStack Query (query key factory hər feature-də). Lokal UI state: `useState`/URL query params. Qlobal store yoxdur (lazım olsa Zustand — ADR ilə).
- API yalnız `@payproof/api-client` vasitəsilə; `fetch` birbaşa çağırılmır.
- Formalar: react-hook-form + zod; xəta mesajları Azərbaycan dilində, sahənin altında.
- UI mətnləri komponentdə hardcode edilmir — `@payproof/api-client/i18n` (`t.package.status.NEEDS_FIX`).
- Rənglər/spacing yalnız tokenlərdən (Tailwind preset). Hex rəng kodda yoxdur.
- Pul və tarix yalnız `formatMoney`, `formatDate` ilə.

## Əlçatanlıq (məcburi)
Semantik HTML, hər input-a label, ikon düymələrinə `aria-label`, görünən focus, WCAG AA kontrast, xəta yalnız rənglə yox — mətn + ikon. Mobil toxunma sahəsi ≥ 44×44 px. Light və dark rejim.

## UI davranışı
Hər əməliyyatın loading, success, error vəziyyəti var. Siyahıların boş vəziyyəti izahlıdır. Dağıdıcı əməliyyat (silmə, ləğv, sıfırlama) təsdiq dialoqu ilə. Prototipdəki mətnlər və axın əsasdır.
