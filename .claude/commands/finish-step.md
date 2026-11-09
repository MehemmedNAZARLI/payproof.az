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
3. Kod nəzərdən keçirmə **edilmir** (token qənaəti): `code-review`, `simplify`, `code-reviewer` subagent-i və digər review skill/agent-lərini işlətmə. Keyfiyyəti testlər, lint/typecheck və CI təmin edir.
4. `git log --oneline main..HEAD` — hər commit formatda və kiçikdir; deyilsə istifadəçiyə de.
5. `/sync` — `main`-ə rebase, testləri yenidən işlət.
6. `docs/progress/<track>.md`: status ✅, tarix (bu gün), qısa qeyd → commit `docs($ARGUMENTS): mark step done`.
7. Remote varsa: `git push -u origin HEAD` və `gh pr create` (şablon: `.github/pull_request_template.md`, başlıq: `<ID>: <step adı>`). PR-ı **merge etmə** — istifadəçi CI-dan sonra edir. Remote yoxdursa: lokal merge əmrini (`git switch main && git merge --no-ff <branch>`) göstər, özün icra etmə.
8. W-*, M-*, B-* step-lərində: aşağıdakı **Preview** bölməsinə əməl et — istifadəçi nəticəni öz gözü ilə görməlidir.
9. Növbəti mümkün step-i göstər (`/next-step <track>` məntiqi ilə).

## Preview
Server artıq işləyirsə yenidən başlatma (portu yoxla: `lsof -nP -iTCP:<port> -sTCP:LISTEN`). Sonda serveri **dayandırma** — istifadəçi baxacaq.

- **Web (W-\*)**: dev server işləmirsə `NEXT_PUBLIC_API_MOCK=1 pnpm --filter web dev`-i arxa planda başlat (port 3000) və açıldığını yoxla (`curl -sf http://localhost:3000` 200 qaytarmalıdır). Sonda klikləmək üçün linklər ver: `http://localhost:3000/<bu step-də dəyişən səhifələr>` — hər linkin yanında bir sətirlə "burada nəyə baxmalısan" və hansı demo istifadəçi ilə daxil olmaq lazımdır (Aygün Məmmədova — operator, Rəşad Əliyev — təsdiqçi, Kamran Babayev — yalnız baxış).
- **Mobile (M-\*)**: eyni qayda, port 3001 (`NEXT_PUBLIC_API_MOCK=1 pnpm --filter mobile dev`). Qeyd et: brauzerdə DevTools → cihaz rejimi → iPhone (390×844) görünüşü ilə baxılmalıdır.
- **Backend (B-\*)**: `uv run payproof-api`-ni arxa planda başlat (`apps/api`-də, port 8000), açıldığını yoxla, `http://localhost:8000/docs` (Swagger) linkini və yoxlamaq üçün 1–2 nümunə sorğu ver (məs. `curl` ilə dev-login → token → həmin step-in endpoint-i).
- PR-da Vercel preview linki varsa (`gh pr view --json statusCheckRollup,comments`), onu da göstər.
