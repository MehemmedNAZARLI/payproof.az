# Buradan başlayın

## Kim nə edir
| Şəxs | Track-lər | Step faylları | Prompt faylı |
|---|---|---|---|
| **Siz (lead)** | Shared (S), Backend (B), Web (W), Integration (I) | `roadmap/steps/shared.md`, `backend.md`, `web.md`, `integration.md` | `prompts/lead.md` |
| **Mobil komanda yoldaşı** | Mobile (M) | `roadmap/steps/mobile.md` | `prompts/mobile.md` |

Hər iki tərəf `CLAUDE.md`, `docs/engineering/*` və `docs/architecture/*` qaydalarına əməl edir.

## Ardıcıllıq
```
Faza 0  Shared S-01 … S-08         (yalnız lead, ardıcıl)        ──┐
                                                                  ▼
Faza 1+ Backend B-xx  ║  Web W-xx  ║  Mobile M-xx   (paralel)
                                                                  ▼
Faza 5  Integration I-01 … I-03    (hamı)
```
- Web və Mobile backend hazır olmadan işləyir: `packages/mocks` (MSW) eyni API müqaviləsini fixtures ilə təqlid edir.
- Backend-ə qoşulma `W-18` və `M-12` step-lərindədir.
- Tam plan: `roadmap/ROADMAP.md`.

## 1-ci gün — lead
1. Alətləri qurun: `brew install uv` (Python 3.12-ni uv özü yükləyəcək), Node 22+, pnpm 9+, Docker Desktop.
2. Repo qovluğunda: `./scripts/setup.sh`
3. `claude` başladın və yazın: **`/next-step shared`** (və ya `prompts/lead.md`-dəki ilk prompt).
4. S-08 bitəndə repo GitHub-a push olunur, komanda yoldaşı clone edir.

## 1-ci gün — mobil komanda yoldaşı (S-08-dən sonra)
1. `git clone <repo>` → `./scripts/setup.sh` → `pnpm install`
2. `claude` başladın və yazın: **`/next-step mobile`**
3. `prompts/mobile.md` faylındakı gündəlik prompt-lardan istifadə edin.

## Paralel iş (lead backend + web eyni anda)
Hər track ayrıca git worktree-də, ayrıca Claude Code sessiyasında işləyir — `engineering/parallel-work.md`.

## Əsas əmrlər (Claude Code daxilində)
| Əmr | Nə edir |
|---|---|
| `/next-step <track>` | Track üzrə asılılıqları bitmiş növbəti step-i tapır və başlayır |
| `/step <ID>` | Konkret step-i icra edir (branch, plan, TDD, kiçik commit-lər) |
| `/finish-step <ID>` | DoD yoxlaması, progress yeniləmə, merge-ə hazırlıq |
| `/status` | Bütün track-lərin vəziyyəti |
| `/contract-change` | API müqaviləsini dəyişmək prosesi |
| `/sync` | `main`-dən son dəyişiklikləri branch-a gətirir |
