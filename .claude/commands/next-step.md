---
description: Track üzrə asılılıqları bitmiş növbəti step-i tap və başla
argument-hint: <shared|backend|web|mobile|integration>
---

Track: **$ARGUMENTS**

1. `docs/progress/$ARGUMENTS.md` və `docs/roadmap/steps/$ARGUMENTS.md`-i oxu. Asılılıqlar başqa track-dədirsə, həmin progress fayllarını da oxu (əvvəlcə `git fetch` + `main`-in son vəziyyəti — remote varsa).
2. 🟡 statusda step varsa — onu davam etdirməyi təklif et (branch-ı göstər).
3. Yoxdursa: sıra ilə ilk ⬜ step-i tap ki, bütün asılılıqları ✅ olsun. Heç biri hazır deyilsə — hansı step-in nəyi gözlədiyini cədvəl kimi göstər və dayan.
4. Tapılan step-in qısa xülasəsini göstər (məqsəd, daxildir, qəbul meyarları) və `/step <ID>` protokolu ilə icraya başla.
