# apps/web — Veb tətbiq qaydaları

Track: **W** (`docs/roadmap/steps/web.md`). Əvvəl kök `CLAUDE.md`-ni oxu. Qovluq W-01-də yaradılır.
İstifadəçilər: operator, təsdiqçi, auditor. Vizual/mətn mənbəyi: prototipin "Veb tətbiq" görünüşü (`docs/product/prototype/payproof-prototype.html`).

## Quruluş
```
src/
  app/(auth)/login · app/(app)/{overview,packages,packages/[id],tasks,rules,audit}/page.tsx   # nazik
  features/<feature>/{components/,hooks/,queries.ts,index.ts}
  components/ui/      shadcn əsaslı ümumi komponentlər
  lib/{api.ts,query-client.ts,auth.ts,msw.ts}
e2e/                  Playwright
```

## Əmrlər
`pnpm --filter web dev` (:3000) · `build` · `lint` · `typecheck` · `test` · `e2e`
Mock rejimi: `.env.local` → `NEXT_PUBLIC_API_MOCK=1` (default). Real API: `NEXT_PUBLIC_API_MOCK=0`, `NEXT_PUBLIC_API_URL=http://localhost:8000`.

## Qaydalar
- API yalnız `@payproof/api-client`; server state yalnız TanStack Query; query key-lər feature-in `queries.ts`-ində.
- Filtr/sıralama/pagination URL query-də (paylaşıla bilən, geri düyməsi işləyir).
- Mətnlər `@payproof/api-client/i18n`-dən; rənglər tokenlərdən; pul/tarix `format*` ilə. Frontend pul hesablamır.
- Səlahiyyət `useMe().permissions`-dən; düyməni gizlətmək təhlükəsizlik deyil — server 403 verəndə izahlı toast.
- Mutation-lar `expected_version` və (approve/export/upload) `Idempotency-Key` göndərir; 409 → "Paket yenilənib" dialoqu + refetch.
- Hər ekran: skeleton (400–800 ms), boş vəziyyət, xəta vəziyyəti. Dağıdıcı əməliyyat → `ConfirmDialog`.
- Layout: container query ilə (paket detalı 1/2/3 sütun). 768-dən aşağı sidebar drawer olur.
- UI step-i bitəndə brauzerdə 1440/1024/768 px və light/dark yoxla.
