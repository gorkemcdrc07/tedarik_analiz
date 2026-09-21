# Yakıt Değişim Merkezi

Bu sürümde üç ayrı yakıt ekranı tek ekranda birleştirildi: `/finans/yakit-hesaplama`.

- Müşteri bazında Petrol Ofisi / Shell referansı ve anlık motorin fiyatı gösterilir.
- Baz fiyat, anlık fiyat, değişim oranı, müşteri eşiği ve tarifeye uygulanacak etki tek tabloda görünür.
- `Fiyatları Yenile` yalnızca canlı referans fiyatlarını okur; müşteri tarifesini değiştirmez.
- `Kontrol Et ve Uygula` mevcut eskalasyon kurallarını çalıştırır.
- Backend otomasyonu her saat başı çalışır.
- Tarife gerçekten güncellenirse `fuel_notifications` tablosuna sistem bildirimi yazılır.
- Aynı durumda e-posta gönderimi de tetiklenir.

## E-posta ortam değişkenleri

Server / Vercel ortamında aşağıdaki değişkenleri tanımlayın:

```
FUEL_ALERT_EMAIL_TO=alici1@firma.com;alici2@firma.com
FUEL_SMTP_HOST=smtp.office365.com
FUEL_SMTP_PORT=587
FUEL_SMTP_USER=bildirim@firma.com
FUEL_SMTP_PASS=uygulama_sifresi_veya_smtp_sifresi
FUEL_MAIL_FROM=bildirim@firma.com
```

`FUEL_ALERT_EMAIL_TO` birden fazla adres için `;` veya `,` ile ayrılabilir. SMTP bilgileri tanımlı değilse sistem bildirimi çalışmaya devam eder, sadece e-posta atlanır.
