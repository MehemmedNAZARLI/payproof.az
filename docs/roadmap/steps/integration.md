# Integration track (I) — real stack-də demo

**Sahib:** lead (M hissələri üçün komanda yoldaşı ilə birlikdə)

### I-01 · Tam axın real stack-də
**Branch:** `feat/I-01-e2e-real` · **Asılılıq:** W-18, M-12
**Daxildir:** `docker compose up` (postgres, minio, api, worker, web, mobile — Dockerfile-lar), `make demo` (up + migrate + seed), Playwright: veb-də INV-1042 düzəliş axını → mobildə təsdiq → veb-də ixrac; audit-də bütün addımlar.
**Qəbul:** [ ] təmiz maşında `make demo` ilə 5 dəqiqədə işləyir

### I-02 · Demo hazırlığı
**Branch:** `feat/I-02-demo-ready` · **Asılılıq:** I-01
**Daxildir:** `POST /v1/demo/reset` + UI-də "Demonu sıfırla" (yalnız `ENV=dev`), demo ssenarisi sənədi (`docs/product/demo-script.md` — prototipdəki 13 addım real tətbiq üçün), internet olmadan işləmə yoxlaması (mock AI), README "Demo" bölməsi, hakimlər üçün qısa "Nə real, nə simulyasiyadır" siyahısı.
**Qəbul:** [ ] sıfırlama 3 saniyədən az [ ] ssenari iki nəfər tərəfindən quru məşqdən keçib

### I-03 · v0.1.0 buraxılışı
**Branch:** `chore/I-03-release` · **Asılılıq:** I-02 · **Skills:** `git-workflow-and-versioning`, `shipping-and-launch`
**Daxildir:** `CHANGELOG.md`, `v0.1.0` tag, deploy (Vercel: web, mobile; Railway/Render: api, worker, postgres; S3/R2), mühit dəyişənlərinin yoxlanması, məlum məhdudiyyətlər siyahısı.
**Qəbul:** [ ] deploy olunmuş URL-lərdə demo axını işləyir
