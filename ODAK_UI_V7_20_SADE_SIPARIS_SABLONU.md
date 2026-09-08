# V7.20 - Sade Sipariş Giriş Şablonu

Sipariş Girişi sekmesi yalnızca şu 8 kullanıcı giriş kolonunu içerir:
1. Müşteri Adı
2. Sipariş Tarihi
3. Müşteri Sipariş No
4. İstenilen Araç Tipi
5. Açıklama
6. Yükleme Firması Adı
7. Alıcı Firma Cari Adı
8. Teslim FirmaAdres Adı

Müşteri Adı Excel'den okunur ve `musteriler` tablosundaki firma ünvanı ile otomatik eşleştirilir. Eşleşen aynı kayıt satırından VKN, Proje Kartı ID ve Ürün ID doldurulur. Sipariş tarihi üzerinden Yükleme Tarihi ve Teslim Tarihi hazırlanır. Kap Adet=25, Ambalaj Tipi=1, Brüt KG=25.000 varsayılanları korunur. Nihai dışa aktarım yine Sipariş Oluştur ekranının 20 kolonluk standart formatındadır.
