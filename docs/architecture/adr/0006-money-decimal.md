# ADR-0006: Pul və miqdar
**Status:** qəbul edilib · 2026-11-08

**Qərar:** Python-da `decimal.Decimal` (`Money` value object, `ROUND_HALF_UP`, valyutaya görə 2 onluq). DB-də `NUMERIC(18,2)`. API-də string. Frontend-də hesablama **edilmir** — yalnız göstərmə (`formatMoney("12000.00","AZN") → "12.000,00 AZN"`); mock mühərriki qəpik tam ədədləri ilə işləyir. Fərqli valyutalar heç vaxt toplanmır və avtomatik çevrilmir.
