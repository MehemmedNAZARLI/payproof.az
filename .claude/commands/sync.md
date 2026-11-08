---
description: main-dəki son dəyişiklikləri cari step branch-ına gətir
---

1. `git status` təmiz olmalıdır (deyilsə — istifadəçiyə de, stash etmə).
2. Remote varsa: `git fetch origin && git rebase origin/main`; yoxdursa `git rebase main`.
3. Konflikt olarsa: hər faylı izah et, həll et (başqa track-in kodunu dəyişmə), `git rebase --continue`.
4. `CONTRACT-CHANGELOG.md` dəyişibsə və bu frontend track-dirsə: `pnpm --filter @payproof/api-client generate`, typecheck — tip xətalarını həll et (ayrıca commit).
5. Track testlərini işlət. Branch artıq push olunubsa: `git push --force-with-lease` (yalnız öz branch-ında).
