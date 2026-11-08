# Paralel iş: bir neçə Claude Code sessiyası

## Qayda
Hər paralel track **öz git worktree-sində**, **öz Claude Code sessiyasında**, **öz branch-ında** işləyir. Eyni fayla iki sessiya toxunmur.

| Track | Qovluqlar (yazma icazəsi) | Kim |
|---|---|---|
| Shared (S) | `packages/*`, `fixtures/`, kök konfiqurasiya, `.github/` | lead |
| Backend (B) | `apps/api/` | lead |
| Web (W) | `apps/web/` | lead |
| Mobile (M) | `apps/mobile/` | komanda yoldaşı |
| Hamı | öz track-inin `docs/progress/<track>.md` faylı | |

`packages/*`-də dəyişiklik lazımdırsa (məs. mock-a yeni handler) — ayrıca kiçik `contract/` və ya `fix/` branch-ı, tez merge.

## Worktree qurmaq (lead: backend + web eyni anda)
```bash
# repo kökündə (main yenidir)
git worktree add ../payproof-api  -b feat/B-01-api-skeleton
git worktree add ../payproof-web  -b feat/W-01-web-skeleton

# Terminal 1
cd ../payproof-api && claude      # → /step B-01
# Terminal 2
cd ../payproof-web && claude      # → /step W-01
```
Step bitib merge olunandan sonra:
```bash
git worktree remove ../payproof-api
git worktree add ../payproof-api -b feat/B-02-db-foundation main
```
(`superpowers:using-git-worktrees` skill-i varsa onu istifadə edin.)

## Sinxronizasiya
- Hər step-in əvvəlində və merge-dən qabaq: `/sync` (`git fetch && git rebase origin/main`).
- Müqavilə dəyişəndə (`CONTRACT-CHANGELOG.md`-də yeni qeyd): frontend track-ləri `/sync` edib `pnpm --filter @payproof/api-client generate` işlədir.
- `docs/progress/` faylları track-ə görə ayrıdır — konflikt olmur.

## Kommunikasiya
- Bloklanma: progress faylında step-i `🚧 blocked: <səbəb>` kimi qeyd et və digər tərəfə de.
- Müqavilə təklifi: `contract/<ad>` branch + PR; digər track-lər review edir.
