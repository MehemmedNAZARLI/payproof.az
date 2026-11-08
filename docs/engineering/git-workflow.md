# Git iş axını

## Branch-lar
- `main` — həmişə işləyən vəziyyət. Birbaşa commit yoxdur (GitHub-da branch protection: PR + CI yaşıl).
- Hər step = bir branch: `feat/<STEP-ID>-<kebab-ad>`
  - `feat/S-04-openapi-contract`, `feat/B-07-rules-engine-1`, `feat/W-06-dashboard`, `feat/M-09-approval-flow`
- Düzəliş: `fix/<STEP-ID|area>-<ad>` · müqavilə: `contract/<ad>` · sənəd: `docs/<ad>`
- Branch ömrü qısadır (1 step). Step çox böyükdürsə, `B-08a`, `B-08b` kimi bölünür və progress faylına əlavə edilir.

## Commit-lər — kiçik və tez-tez
- **Bir commit = bir məntiqi addım** (bir test + onu keçirən kod; bir komponent; bir miqrasiya).
- Hədəf **50–150 sətir** dəyişiklik. **Maksimum 200 sətir** — `.githooks/pre-commit` yoxlayır.
  - Sayılmır: `*.lock`, `pnpm-lock.yaml`, `uv.lock`, `packages/api-client/src/generated/**`, `apps/api/migrations/versions/**`, `fixtures/**`, `docs/**`, `*.md`, şəkillər.
  - Limiti keçirsə: dəyişikliyi böl (`git add -p`), heç vaxt `--no-verify`.
- Hər commit-dən əvvəl həmin hissənin testləri keçməlidir. Qırıq commit yoxdur.
- Format (Conventional Commits, `.githooks/commit-msg` yoxlayır):
  ```
  <type>(<STEP-ID|scope>): <imperativ, ingiliscə, ≤72 simvol>

  [niyə — lazım olsa]
  ```
  `type`: `feat` `fix` `refactor` `test` `docs` `chore` `build` `ci` `perf` `style`
  Nümunələr: `test(B-07): cover R-001 missing and unreadable PO` · `feat(B-07): implement R-001 PO reference rule` · `feat(W-07): add packages table with URL filters`

## Step-in commit ritmi (nümunə)
1. `test(...)`: qırmızı test(lər)
2. `feat(...)`: minimal implementasiya → yaşıl
3. `refactor(...)`: təmizləmə (davranış dəyişmir)
4. Növbəti alt-hissə üçün təkrar
5. `docs(...)`: progress faylı + lazım olsa sənəd

## Merge
1. `/sync` — `main`-i branch-a rebase et, testləri işlət.
2. `/finish-step <ID>` — DoD.
3. GitHub-da PR (`.github/pull_request_template.md`), CI yaşıl.
4. **"Create a merge commit"** (squash yox — kiçik commit tarixçəsi qalsın). Merge-dən sonra branch-lar silinmir, saxlanılır (`--delete-branch` istifadə etmə).
5. Remote olmadan lokal: `git switch main && git merge --no-ff feat/<...>`.

## Qadağanlar
`git push --force` (öz branch-ında `--force-with-lease` olar), `main`-ə birbaşa push, `--no-verify`, generasiya olunan faylı əl ilə dəyişmək, başqa track-in qovluğunda iş, sirr commit etmək.
