---
description: Step-i Definition of Done üzrə yoxla, progress-i yenilə, merge-ə hazırla
argument-hint: <STEP-ID>
---

Step **$ARGUMENTS** üçün bitiriş:

1. `docs/engineering/definition-of-done.md`-dəki hər bəndi yoxla və nəticəni cədvəl kimi göstər (✓ / ✕ + sübut).
2. Track üzrə tam yoxlama:
   - Backend: `cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest`
   - Web/Mobile/Packages: `pnpm turbo run lint typecheck test --filter=<workspace>`
   - UI step-ləri: dev server-i aç, əsas ekranları brauzerdə yoxla (veb: 1440/1024/768; mobil: 390), konsolda xəta olmamalıdır.
3. Kod nəzərdən keçirmə: `code-review` skill-i və ya `code-reviewer` subagent-i ilə `git diff main...HEAD`. Kritik tapıntıları düzəlt (ayrıca kiçik commit-lərlə).
4. `git log --oneline main..HEAD` — hər commit formatda və kiçikdir; deyilsə istifadəçiyə de.
5. `/sync` — `main`-ə rebase, testləri yenidən işlət.
6. `docs/progress/<track>.md`: status ✅, tarix (bu gün), qısa qeyd → commit `docs($ARGUMENTS): mark step done`.
7. Remote varsa: `git push -u origin HEAD` və `gh pr create` (şablon: `.github/pull_request_template.md`, başlıq: `<ID>: <step adı>`). PR-ı **merge etmə** — istifadəçi CI-dan sonra edir. Remote yoxdursa: lokal merge əmrini (`git switch main && git merge --no-ff <branch>`) göstər, özün icra etmə.
8. Növbəti mümkün step-i göstər (`/next-step <track>` məntiqi ilə).
