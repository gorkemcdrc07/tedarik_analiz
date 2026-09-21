# Yakıt Otomasyonu V4

- Backend her gün 10:00 (Europe/Istanbul) merkezi kontrol yapar.
- Shell ve Petrol Ofisi fiyatları backend tarafından alınır.
- Her müşteri baz fiyatına göre değerlendirilir; günlük gözlenen fiyat baz fiyatı bozmaz.
- Eşik sağlanırsa pending action oluşur. Uygulama açık olan ilk istemci aksiyonu otomatik uygular ve backend'e ACK gönderir; baz fiyat ancak ACK sonrası ilerler.
- FASDAT Supabase tarifeleri istemci Supabase bağlantısı üzerinden otomatik güncellenir.
- Diğer müşterilerin tarifeleri halen localStorage tabanlı olduğu için tam sunucu-bağımsız otomasyon için bu tarifelerin Supabase tablolarına taşınması sonraki zorunlu adımdır.
- `/api/fuel-automation/status`: durum, sonuçlar, bildirimler, pending işlemler.
- `/api/fuel-automation/run`: manuel merkezi tetikleme.
