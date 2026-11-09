# ADR-0009: Qayda dəsti dəyişəndə paket versiyası artır
**Status:** qəbul edilib · 2026-11-08

**Kontekst:** CLAUDE.md invariantı "sənəd, kritik sahə, sifariş əlaqəsi **və ya qayda** dəyişəndə paket versiyası artır" deyir; data-model.md və prototipin `dSaveRules()` funksiyası isə versiyanı artırmırdı — təsdiq yalnız `requirement_set_version` fərqinə görə etibarsız sayılırdı. Nəticədə təsdiqçiyə bildiriş getmirdi və versiya ilə keşləyən klientlər dəyişikliyi görmürdü. S-06 review-da aşkarlandı; lead qərarı.

**Qərar:**
- Müştərinin yeni qayda dəsti təsdiqlənəndə həmin müştərinin **cari versiyası ixrac edilməmiş** hər paketi (emal olunanlar istisna) yeni versiya alır — eyni `bump` yolu ilə: cari təsdiq `valid=false` (səbəb: "qayda dəsti vN qüvvəyə mindi", auditdə qalır), təsdiqçiyə bildiriş, sonra yoxlama yeni qayda dəsti ilə.
- Cari versiyası ixrac edilmiş paketə toxunulmur — ixrac zamanındakı qayda dəstində qalır.
- Approve/export həm `expected_version`, həm `expected_requirement_set_version` yoxlayır (görmədiyi qayda versiyasını təsdiqləmək olmaz).

**Nəticələr:** mock (`packages/mocks`) bu qaydaya uyğunlaşdırıldı; backend (B-22) eyni davranışı golden/integration testlə təsdiqləyir. Prototip bu nöqtədə istinad deyil.
