# V7.19 – Excel müşteri otomatik eşleştirme

- Sipariş Excel'i içeri alındığında sistem artık kullanıcıdan yeniden müşteri seçmesini beklemez.
- Yükleme Firması Adı, Alıcı Firma Cari Adı ve Teslim Firma Adres Adı alanları müşteri unvanlarıyla karşılaştırılır.
- Tam eşleşme bulunduğunda aynı `musteriler` satırından VKN, Proje Kartı ID ve Ürün ID otomatik doldurulur.
- Kap Adet boşsa `25`, Ambalaj Tipi boşsa `1`, Brüt KG boşsa `25.000` atanır.
- Bu üç alan Excel'de doluysa kullanıcının değeri korunur.
- Şablonun 20 standart başlığı korunur; otomatik/opsiyonel alanların başlığının dosyada olmaması içe aktarımı engellemez. Zorunlu giriş başlıkları ayrı kontrol edilir.
