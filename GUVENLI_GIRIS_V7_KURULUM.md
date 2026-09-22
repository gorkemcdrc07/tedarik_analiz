# V7 Güvenli Giriş / E-posta OTP

## Akış
1. Kullanıcı adı + şifre backend tarafından Supabase `Login` tablosunda doğrulanır.
2. Kullanıcının `email` alanına (yoksa e-posta biçimindeki `kullanici_adi`) 6 haneli kod gönderilir.
3. Kod 5 dakika geçerlidir, tek kullanımlıktır ve 5 hatalı denemeden sonra challenge kapanır.
4. Yeniden kod gönderimi 45 saniye sınırlandırılmıştır.
5. OTP doğrulanmadan `loginUser` oluşturulmaz ve uygulama açılmaz.
6. OTP başarılı olduğunda 8 saatlik imzalı session token üretilir; tarayıcı oturumu kapanınca yeniden 2FA gerekir.

## Kurulum
- `supabase/migrations/20260922_login_2fa_security.sql` migrationını çalıştırın.
- Login tablosunda her gerçek kullanıcı için geçerli `email` olduğundan emin olun.
- `server/.env` içine `AUTH_SMTP_*`, `AUTH_MAIL_FROM` ve güçlü `AUTH_SESSION_SECRET` değerlerini girin.
- AUTH SMTP boşsa mevcut `FUEL_SMTP_*` ayarları fallback olarak kullanılır.

## Güvenlik notu
Mevcut sistemin Login tablosunda şifrelerin düz metin tutulduğu görülüyor. V7, mevcut yapıyı kırmamak için bu alanla uyumludur; sonraki güvenlik adımı şifreleri Argon2/bcrypt hash'e geçirmek olmalıdır. `Reel_sifre` gibi harici servis parolalarının da tarayıcı localStorage'ında tutulmaması önerilir.
