# V9 2FA JSON / Canlı Ortam Düzeltmesi

## Neden `Unexpected token '<'` oluşuyordu?
Frontend `response.json()` çağırırken `/api/auth/2fa/start` için backend yerine HTML 404/index sayfası dönebiliyordu. JSON parser ilk `<` karakterinde hata veriyordu.

## V9 değişiklikleri
- Login API yanıtı önce `Content-Type` ve HTTP status üzerinden güvenli şekilde okunur.
- HTML/404 gelirse kullanıcıya anlaşılır servis hatası gösterilir; JSON parse exception gösterilmez.
- Local: `.env.development` -> `http://localhost:5000`.
- Production: `.env.production` -> `https://tedarik-analiz-backend.onrender.com`.
- Express `/api/*` bilinmeyen endpointleri HTML yerine JSON 404 döndürür.
- `/api/auth/2fa/health` endpointi backend hazır olma kontrolü için kullanılabilir.

## Local çalıştırma
Kök klasörde `npm start`. Bu komut hem React'i hem `server/` uygulamasını çalıştırır.

## Canlı için zorunlu
Render'daki `tedarik_analiz_backend` servisi mevcutta ayrı GitHub reposundan deploy oluyor. Bu ZIP'teki güncel `server/auth2fa.js` ve `server/index.js` değişiklikleri o backend'e de deploy edilmeden canlı 2FA endpointi oluşmaz.

Render'da gerekli env anahtarları:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- AUTH_SMTP_HOST
- AUTH_SMTP_PORT
- AUTH_SMTP_USER
- AUTH_SMTP_PASS
- AUTH_MAIL_FROM
- AUTH_SESSION_SECRET

Frontend production API adresi:
`https://tedarik-analiz-backend.onrender.com`
