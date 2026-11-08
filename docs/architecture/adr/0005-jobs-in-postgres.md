# ADR-0005: Fon işləri PostgreSQL-də
**Status:** qəbul edilib · 2026-11-08

**Qərar:** `jobs` cədvəli + ayrıca worker prosesi (`uv run payproof-worker`), `SELECT … FOR UPDATE SKIP LOCKED`. Retry limiti (3), eksponensial gecikmə, `error_code`. `JobQueue` interfeysi arxasında — yük artanda Redis/SQS-ə keçid yalnız adapterdə.

**Niyə:** brif §16 tövsiyəsi; əlavə infrastruktur yoxdur; tranzaksiya ilə birlikdə job yaratmaq olur (outbox effekti).
