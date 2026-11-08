# ADR-0008: Tapşırıq icraçıları (assignee) rolu
**Status:** qəbul edilib · 2026-11-08

**Kontekst:** Demo dataset-də anbar (Elvin Qasımov), satış (Nigar Hüseynova) və mühasibatlıq (Leyla Rzayeva) əməkdaşları tapşırıq alır. Prototipdə onlar sənəd də yükləyir, amma brifin §20 səlahiyyət matrisində (Operator, Təsdiqçi, Admin, Yalnız baxış) belə rollar yoxdur.

**Qərar:**
- P0-da bu əməkdaşlar sistemə daxil olan istifadəçi deyil — yalnız **tapşırıq icraçısıdır**. `memberships.role = assignee`.
- `assignee` rolunun heç bir icazəsi yoxdur: `GET /v1/me` → `permissions: []`; `dev-users` / dev-login siyahısında yoxdurlar.
- Onların gətirdiyi sənədi **operator** yükləyir; tapşırıq statusunu operator dəyişir. Auditdə actor operatordur (icraçı yox).
- `GET /v1/users?assignable=true` icraçıları da qaytarır (məsul seçimi üçün); tapşırığın `assignee` sahəsi onlara işarə edə bilər.
- §20 matrisi dəyişmir.

**Nəticələr:**
- Bildirişlər və UI yalnız daxil olan rollar üçündür; icraçıya bildiriş P0-da sistem daxilində göstərilmir.
- Fixtures-da `warehouse`, `sales`, `accounting` rolları `assignee` ilə əvəzlənir; prototipdə onların adından olan yükləmələr fixtures-da paketin operatoruna (məsul şəxsinə) yazılır.
- Mühərrik nəticələri dəyişmir (rol qayda girişinə daxil deyil).

**Gələcək (P1, indi etmə):** `contributor` rolu — öz tapşırığına sənəd yükləmək və statusunu dəyişmək.
