# Prompt-lar — lead (Shared, Backend, Web, Integration)

Repo kökündə `claude` başladın. Slash əmrlər `.claude/commands/`-dadır və repo ilə gəlir. Aşağıdakı prompt-ları olduğu kimi kopyalayın.

---

## 0. İlk sessiya (bir dəfə)
```
Bu PayProof layihəsinin ilk sessiyasıdır. CLAUDE.md, docs/00-START-HERE.md, docs/roadmap/ROADMAP.md və docs/roadmap/steps/shared.md fayllarını oxu.
Sonra mənə 10 sətirlik xülasə ver: nə qururuq, track-lər, ilk 3 step və hansı alətlərin quraşdırılmalı olduğu (node, pnpm, uv, docker versiyalarını yoxla).
Hələ heç nə dəyişmə.
```
Sonra:
```
/next-step shared
```

## 1. Faza 0 — Shared (S-01 … S-08, ardıcıl)
Hər step üçün:
```
/step S-0X
```
Step bitəndə Claude özü `/finish-step` icra edir. PR-ı (və ya lokal merge-i) siz təsdiqləyirsiniz, sonra:
```
/next-step shared
```
S-08-dən sonra: GitHub-da `main` üçün branch protection qurun, komanda yoldaşını collaborator kimi əlavə edin və ona `docs/prompts/mobile.md`-ni göndərin.

## 2. Paralel iş: Backend + Web (iki terminal)
Bir dəfə (repo kökündə):
```bash
git worktree add ../payproof-api -b feat/B-01-api-skeleton main
git worktree add ../payproof-web -b feat/W-01-web-skeleton main
```
**Terminal 1** (`cd ../payproof-api && claude`):
```
Sən bu sessiyada yalnız Backend track-ində (apps/api) işləyirsən. apps/api/CLAUDE.md-ni də oxu.
/step B-01
```
**Terminal 2** (`cd ../payproof-web && claude`):
```
Sən bu sessiyada yalnız Web track-ində (apps/web) işləyirsən. apps/web/CLAUDE.md-ni də oxu. Backend hazır deyil — NEXT_PUBLIC_API_MOCK=1 ilə işlə.
/step W-01
```
Step merge olunandan sonra eyni terminalda:
```
/sync
/next-step backend
```
(və ya `web`). Worktree köhnə branch-dadırsa: `git switch main && git pull`, sonra `/next-step`.

## 3. Gündəlik başlanğıc
```
/status
```
```
Dünən harada qaldıq? docs/progress/<track>.md və git log-a bax, 🟡 step varsa qalan commit planını göstər və davam et.
```

## 4. Step-in ortasında faydalı prompt-lar
**Plan çox böyükdür:**
```
Bu step-i iki hissəyə böl (<ID>a, <ID>b). docs/roadmap/steps və progress faylını yenilə, birinci hissəni bitir.
```
**Commit hook limiti keçdi:**
```
Pre-commit 200 sətir limitini keçdi. Staged dəyişikliyi məntiqi hissələrə böl (git add -p) və ayrı-ayrı commit et. --no-verify istifadə etmə.
```
**Test qırmızıdır və səbəb aydın deyil:**
```
superpowers:systematic-debugging skill-i ilə bu test xətasının kök səbəbini tap. Əvvəl hipotez, sonra sübut, sonra minimal düzəliş + test.
```
**Müqavilədə çatışmazlıq tapıldı:**
```
/contract-change <nə lazımdır və niyə>
```
**UI prototipdən fərqlənir:**
```
docs/product/prototype/payproof-prototype.html-də <ekran>-ın HTML/CSS-inə bax və bizim komponenti mətn, sıra və vəziyyətlər baxımından ona uyğunlaşdır (dizayn tokenləri ilə, hex rəng olmadan).
```

## 5. Step-in sonu
```
/finish-step <ID>
```
Əlavə yoxlama istəsəniz:
```
code-reviewer subagent-i ilə main...HEAD diff-ini yoxla, kritik və vacib tapıntıları ayrı kiçik commit-lərlə düzəlt.
```

## 6. Real API-yə keçid (W-18)
```
contract-guardian subagent-i ilə openapi.yaml, mocks və apps/api arasında fərqləri tap. Sonra /step W-18.
```

## 7. CI qırmızıdır
```
gh pr checks ilə uğursuz job-u tap, log-u oxu, kök səbəbi düzəlt (kiçik commit), push et. Testi söndürmə, skip etmə.
```

## 8. Integration
```
/next-step integration
```

## Plain-text variant (slash əmr işləməsə)
```
CLAUDE.md və docs/roadmap/steps/backend.md-dəki B-07 step-ini oxu. .claude/commands/step.md-dəki protokola dəqiq əməl et: asılılıqları yoxla, feat/B-07-rules-engine-1 branch-ı yarat, commit planı qur, TDD ilə işlə, hər commit ≤200 sətir, sonda .claude/commands/finish-step.md addımlarını icra et.
```
