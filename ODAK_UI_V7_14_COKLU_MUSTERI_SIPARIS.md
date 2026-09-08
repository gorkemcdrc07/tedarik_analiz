# V7.14 – Çoklu Müşteri / Proje Sipariş Hazırlama

- Sipariş şablonu artık iki sekmeli oluşturulur:
  - `Sipariş Girişi`: kullanıcı giriş kolonları.
  - `Müşteri Adları`: `public.musteriler` tablosundaki tüm aktif kayıtlar.
- Aynı Sipariş Girişi dosyasında farklı satırlarda farklı müşteri ve proje kullanılabilir.
- Excel içeri aktarılırken her satır `Firma Ünvanı + Proje Adı` ile müşteri tablosuna otomatik eşlenir.
- Eşleşen kayıttan VKN, Ürün ID, Proje Kartı ID ve ERP Proje Kodu otomatik alınır.
- Nihai 20 kolonluk çıktıda:
  - `Vkn` = müşteri tablosundaki VKN
  - `Proje` = ERP Proje Kodu; boşsa Proje Kartı ID; o da boşsa Proje Adı
  - `Ürün` = Ürün ID
- Aynı firma/proje için aynı kodlarla tekrar eden teknik kayıtlar tek aday kabul edilir.
- Aynı firma/proje farklı VKN/Ürün/Proje kodları taşıyorsa satır otomatik hazır sayılmaz; kullanıcıya belirsizlik uyarısı verilir.
