# Definition of Done — hər step üçün

Step yalnız bunların hamısı ✓ olanda bitmiş sayılır (`/finish-step` yoxlayır):

## Kod
- [ ] Step-in bütün qəbul meyarları yerinə yetirilib; "Daxil deyil" siyahısındakı iş görülməyib
- [ ] Lint, format, typecheck təmiz (`make lint` və ya track əmri)
- [ ] Bütün testlər yaşıl; yeni məntiq üçün test var (domen — TDD ilə)
- [ ] Domen invariantları (`CLAUDE.md`) pozulmayıb: float pul yox, UNKNOWN≠PASS, server-side səlahiyyət, versiya/təsdiq bağlılığı
- [ ] Fayl/funksiya/komponent ölçü limitləri; ölü kod, `console.log`, `print`, TODO-suz şərh yoxdur
- [ ] UI: loading/empty/error vəziyyətləri, Azərbaycan mətnləri, tokenlər, light/dark, a11y, mobil 44px

## Git
- [ ] Branch adı `feat/<ID>-…`; hər commit ≤ 200 sətir, Conventional Commits formatında, testlər hər commit-də keçir
- [ ] `main` ilə sinxron (`/sync`), konflikt yoxdur

## Sənəd
- [ ] `docs/progress/<track>.md`-də step ✅, tarix, branch, qısa qeyd
- [ ] API dəyişibsə: `openapi.yaml` + `CONTRACT-CHANGELOG.md` + regenerasiya olunmuş client
- [ ] Yeni qərar varsa: qısa ADR (`docs/architecture/adr/`)
- [ ] Yeni əmr/env dəyişəni varsa: README / `.env.example` / app `CLAUDE.md` yenilənib

## Yoxlama
- [ ] `code-review` (və ya `.claude/agents/code-reviewer`) işlədilib, kritik tapıntı qalmayıb
- [ ] UI step-lərində: brauzerdə real yoxlama (veb 1440/1024/768, mobil 390), konsolda xəta yoxdur
