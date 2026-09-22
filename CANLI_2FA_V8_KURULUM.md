# V8 - Local + Canlı 2FA Kurulumu

## Local
1. `server/.env` içinde Supabase ve AUTH_SMTP_* değerlerini doldurun.
2. Proje kökünde `npm start` çalıştırın. Bu komut backend (5000) ve React (3000) süreçlerini birlikte açar.
3. React development ortamı 2FA isteklerini doğrudan `http://localhost:5000` adresine gönderir.
4. Kontrol: `http://localhost:5000/api/auth/2fa/health` JSON dönmelidir.

## Canlı / Vercel + Render
1. Güncel `server/` klasörünü Render backend servisine deploy edin.
2. Render Environment bölümüne `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SMTP_HOST`, `AUTH_SMTP_PORT`, `AUTH_SMTP_USER`, `AUTH_SMTP_PASS`, `AUTH_MAIL_FROM`, `AUTH_SESSION_SECRET` ekleyin.
3. `AUTH_SESSION_SECRET` uzun ve rastgele bir production secret olmalıdır.
4. Vercel frontend deploy'unda `REACT_APP_API_BASE_URL` tanımlamak zorunlu değildir. `vercel.json`, `/api/auth/2fa/*` isteklerini Render backend'e yönlendirir.
5. Önce `https://<backend>/api/auth/2fa/health`, sonra `https://<frontend>/api/auth/2fa/health` adreslerini kontrol edin. İkisi de JSON dönmelidir.
6. Supabase migration `supabase/migrations/20260922_login_2fa_security.sql` bir kez uygulanmalıdır.

## Önemli
Frontend'i tek başına `npm run client` ile açarsanız backend'i ayrıca `npm run server` ile çalıştırın. SMTP parolalarını veya service-role key'i React/Vercel frontend environment değişkenlerine koymayın; yalnızca Render backend'de tutulmalıdır.
