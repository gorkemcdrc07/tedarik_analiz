# V60 — EFOR ÇAY tablo ve kuruş düzeltmesi

- EFOR ÇAY tablo kolonları 5 kolona göre yeniden düzenlendi.
- SIRA kolonu daraltıldı; yükleme/varış/fiyat alanları dengelendi.
- Yatay taşma masaüstünde kaldırıldı, mobilde kontrollü scroll bırakıldı.
- EFOR ÇAY için genel `tariffMoney()` kullanılmıyor; bu fonksiyon tam TL yuvarladığı için özel `eforCayMoney()` eklendi.
- EFOR ÇAY ekranda ve geçmişte fiyatlar her zaman iki ondalıkla gösterilir.
- Başlangıç fiyatları: 23.493,32 / 22.856,81 / 22.856,81 / 21.120,84 / 21.120,84.
- Hesaplama sırasında tam TL yuvarlama yoktur; oran doğrudan ham tutara uygulanır.
- Excel hücreleri de `₺#,##0.00` formatında kuruşlu kalır.
