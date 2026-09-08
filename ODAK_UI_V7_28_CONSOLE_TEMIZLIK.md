# V7.28 – Console Temizliği ve Supabase Singleton

- TMS auth/token debug logları kaldırıldı.
- JWT token artık console'a yazdırılmıyor.
- `AUTH URL`, `AUTH STATUS`, `AUTH RESPONSE`, `TOKEN GELDİ`, `TOKEN_URLS`, `Yeni token alındı` debug çıktıları kaldırıldı.
- Login ekranındaki ikinci Supabase `createClient` kaldırıldı; ortak `supabaseClient` kullanılıyor.
- React Fast Refresh/HMR sırasında Supabase istemcisi `globalThis` üzerinde singleton tutuluyor.
- Böylece aynı storage key ile birden fazla `GoTrueClient` oluşma uyarısı engellenir.
- React DevTools önerisi React'ın development build mesajıdır; production build'de görünmez.
