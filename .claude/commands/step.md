---
description: Roadmap-dəki bir step-i qaydalara uyğun icra et (branch, plan, TDD, kiçik commit-lər)
argument-hint: <STEP-ID, məs. B-07>
---

Step **$ARGUMENTS** icra olunur. Bu protokola dəqiq əməl et:

## 1. Kontekst
1. `CLAUDE.md`, step-in track faylını (`docs/roadmap/steps/{shared|backend|web|mobile|integration}.md` — ID prefiksinə görə: S/B/W/M/I) və step-də adı çəkilən sənədləri oxu. App daxilində işləyirsənsə həmin app-in `CLAUDE.md`-sini də oxu.
2. `docs/progress/<track>.md`-də step-in **bütün asılılıqları ✅** olmalıdır. Deyilsə — dayan, nəyin çatmadığını de və heç nə dəyişmə.
3. `git status` təmiz olmalıdır. `git fetch` (remote varsa) və `main`-in son vəziyyəti.

## 2. Branch
- Step-də göstərilən branch adı ilə: `git switch -c <branch> main` (worktree-dəsənsə və branch artıq varsa — onu istifadə et).
- `docs/progress/<track>.md`-də step-i 🟡 et, branch adını yaz → ilk commit: `docs($ARGUMENTS): start step`.

## 3. Plan
- `superpowers:writing-plans` skill-i varsa onu istifadə et; yoxdursa qısa plan yaz.
- Plan = commit siyahısı. Hər commit bir məntiqi addım, **≤ 200 sətir** (generasiya/lock/fixtures/docs sayılmır). Step-in "Commit-lər" bölməsi varsa ona əsaslan.
- Planı göstər və icraya keç (istifadəçi dayandırmayıbsa təsdiq gözləmə).

## 4. İcra (hər commit üçün)
1. Domen/məntiq: əvvəl qırmızı test (`superpowers:test-driven-development`), sonra minimal kod, sonra refactor.
2. UI: komponent + test; vizual və mətn üçün prototipə bax (`docs/product/prototype/payproof-prototype.html`).
3. Həmin hissənin testlərini və lint/typecheck-i işlət — yaşıl olmadan commit etmə.
4. `git add -p` ilə yalnız bu addımın dəyişikliklərini əlavə et; commit: `<type>($ARGUMENTS): <imperativ ingiliscə təsvir>`.
5. Pre-commit hook limit xətası versə — dəyişikliyi böl. `--no-verify` qadağandır.
- Step-in "Daxil deyil" siyahısındakı işi görmə. Başqa track-in qovluğuna yazma.
- API müqaviləsi ilə uyğunsuzluq görsən: dayan və `/contract-change` təklif et.

## 5. Bitiriş
- Bütün qəbul meyarlarını bir-bir yoxla (sübutla: test çıxışı, əmr nəticəsi, UI üçün brauzerdə yoxlama).
- Sonra `/finish-step $ARGUMENTS` addımlarını icra et.
- Sonda istifadəçiyə: nə edildi, commit siyahısı (`git log --oneline main..HEAD`), nə yoxlanılmadı, növbəti step.
