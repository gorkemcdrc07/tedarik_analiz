# V7.26 - REEL Auth / Gelir-Gider Fix

- `tokenManager.js` yanlış local endpoint olan `/api/reel-auth/login` yerine öncelikle `/reel-auth/api/auth/login` kullanır.
- `/reel-auth/api/auth/login` mevcut `setupProxy.js`, `server/index.js` ve `vercel.json` akışıyla uyumludur.
- Geriye uyumluluk için `/api/reel-auth/login` fallback olarak korunmuştur.
- Bu ortak token yöneticisini kullanan Gelir Ekleme ve Gider Ekleme aynı düzeltmeden faydalanır.
- 404 auth hatası yüzünden çalışan/veri yüklemelerinin ve REEL gönderiminin kırılması giderilmiştir.
