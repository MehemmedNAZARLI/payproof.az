# ADR-0010: Canlı yeniləmələr — SSE (Server-Sent Events)
**Status:** qəbul edilib · 2026-11-08

**Kontekst:** Yeni tələb: bir əməkdaşın etdiyi dəyişikliyi (status, versiya, təsdiq, ixrac, tapşırıq) digər əməkdaş — veb və mobildə — **refresh etmədən, ≤ 2 saniyəyə** görməlidir. İndiyə qədər klient yalnız öz sorğusundan və ya fokus/refetch-dən sonra yenilənirdi. Bütün dəyişikliklər artıq REST ilə gedir; lazım olan yalnız server→client siqnalıdır.

**Qərar:** SSE P0-a daxildir. Polling yalnız ehtiyat yoldur.

### Axın
```
REST yazma sorğusu → service (bir tranzaksiya)
  ├─ domen dəyişikliyi + audit.record(...)
  └─ pg_notify('payproof_events', <hadisə JSON>)   ← eyni tranzaksiyada
COMMIT → Postgres hadisəni yalnız commit-dən sonra çatdırır (rollback → hadisə yoxdur)
API prosesi: bir LISTEN bağlantısı → prosesdaxili hub → hər abunəçinin növbəsi
GET /v1/events (text/event-stream) → tenant filtri → klient → TanStack Query invalidate → refetch
```
- **Mənbə audit yazısıdır:** hadisə `audit.record`-un yazdığı sətirdən törənir və onunla eyni tranzaksiyada `NOTIFY` olunur. Postgres `NOTIFY`-ı commit-ə qədər saxlayır — klient heç vaxt commit olunmamış dəyişikliyi görmür.
- **Bir proses — bir LISTEN bağlantısı** (klient başına yox). Hub hadisəni `company_id`-yə görə uyğun abunəçilərin məhdud növbəsinə (`asyncio.Queue`) qoyur; növbə dolarsa həmin bağlantı bağlanır — klient yenidən qoşulub hər şeyi refetch edir.

### Hadisə yalnız ID daşıyır
```json
{"event_id": "0193…", "company_id": "…", "type": "package.updated",
 "package_id": "…", "package_version": 5, "actor_id": "…", "at": "2026-11-08T09:12:00Z"}
```
- Biznes məlumatı (məbləğ, sənəd mətni, ad) hadisədə **yoxdur** — klient onu adi REST endpoint-indən, öz səlahiyyəti ilə alır. Beləliklə SSE yeni məlumat sızma kanalı açmır və `NOTIFY` 8000 bayt limitinə yaxınlaşmırıq.
- `event_id` = audit yazısının ID-si (uuid7, zamanla artan). `type` siyahısı müqavilədədir (S-09); bilinməyən `type` klientdə "hər şeyi invalidate et" kimi işlənir.
- `actor_id` "kim dəyişdi" toast-u üçündür (ad `GET /v1/users` keşindən). Öz hadisəsi üçün toast göstərilmir, invalidate isə edilir.

### Server (`GET /v1/events`)
- **Tenant filtri serverdə:** `company_id` yalnız JWT-dəki üzvlükdən; query parametri qəbul edilmir. Başqa tenant-ın hadisəsi abunəçinin növbəsinə heç düşmür.
- Başlıqlar: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`. Hər hadisə `id: <event_id>`, `event: <type>`, `data: <JSON>`.
- **15 s heartbeat** (`: ping` şərhi) — proksi/yük balanslaşdırıcı boş bağlantını kəsməsin, klient ölü bağlantını tanısın.
- **`Last-Event-ID`** qəbul edilir, P0-da təkrar oxutma (replay) **yoxdur**: klient yenidən qoşulanda hər şeyi refetch edir — bu, buraxılmış hadisələri sadə və etibarlı şəkildə əvəz edir. `event_id` audit ID olduğu üçün replay sonra audit cədvəlindən əlavə oluna bilər.
- Token vaxtı bitəndə server axını bağlayır; klientin növbəti qoşulması `401` alır → giriş ekranı.

### Klient
- **Auth:** brauzerin `EventSource`-u header göndərə bilmir. Ona görə `fetch` əsaslı SSE klienti (`@payproof/api-client`, `ReadableStream` parser) `Authorization: Bearer` header-i ilə qoşulur — token URL-ə, deməli access log-a düşmür.
- Yenidən qoşulma: eksponensial gecikmə (1 s → 30 s, jitter). Hər uğurlu (yenidən) qoşulmada **bütün** server state invalidate olunur.
- **Ehtiyat polling:** axın qırıq qaldığı müddətdə aktiv sorğular 30 s-dən bir refetch olunur; axın bərpa olunanda polling dayanır.
- Mobil: səhifə gizlənəndə (`visibilitychange`) axın bağlanır, qayıdanda yenidən qoşulur + refetch (iOS fon bağlantılarını onsuz da kəsir).

### Mock rejimi (`NEXT_PUBLIC_API_MOCK=1`)
- MSW `GET /v1/events` handler-i mock store-un hadisə emitter-indən axın (`ReadableStream`) qaytarır — klient kodu real API ilə eynidir.
- Eyni brauzerin tab-ları arasında **`BroadcastChannel`**: yazan tab hadisəni mock DB-nin snapshot-u ilə yayır, qəbul edən tab öz mock DB-sini yeniləyib hadisəni öz axınına ötürür (hər tab-ın ayrıca in-memory mock DB-si var).
- Məhdudiyyət: `BroadcastChannel` yalnız eyni origin-dədir — veb (`:3000`) və mobil (`:3001`) mock rejimində **ayrı mock bazalarıdır** və bir-birini görmür. Cihazlar arası yoxlama yalnız real API ilə (M-12, I-01).

### WebSocket niyə yox
- Lazım olan yalnız server→client siqnalıdır; yazmalar REST-də qalır (idempotentlik, `expected_version`, 409 — hamısı artıq orada). İkitərəfli kanal əlavə protokol və state gətirir, fayda vermir.
- Brauzer WebSocket-ə `Authorization` header-i qoya bilmir — token URL-ə (log-lara) düşməli və ya ayrıca "ticket" endpoint-i yazılmalıdır.
- SSE adi HTTP-dir: eyni auth middleware, CORS, correlation id, proksi; yenidən qoşulma və `Last-Event-ID` standartdır.

**Nəticələr:**
- Müqavilə: `GET /v1/events` + `LiveEvent` sxemi (S-09, `/contract-change`). Step-lər: S-09 (müqavilə + mock axını), B-12b (server), W-05b (veb), M-04b (mobil); cihazlar arası meyar M-12 və I-01-də.
- Hər API prosesi bir əlavə DB bağlantısı (LISTEN) saxlayır; açıq SSE bağlantıları worker/proses limitində nəzərə alınır.
- Hadisə itsə belə ən pis hal: 30 s ehtiyat polling və ya növbəti yenidən qoşulmada tam refetch. Məlumatın düzgünlüyü SSE-dən asılı deyil — həqiqət mənbəyi REST cavabıdır.
