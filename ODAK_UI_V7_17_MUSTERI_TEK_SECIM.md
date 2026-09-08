# V7.17 - Müşteri tek seçim / aynı satır ID otomatik dolum

- Sipariş Girişi şablonundan `Proje Adı` kaldırıldı.
- Sipariş önizlemesinden proje seçimi kaldırıldı.
- Müşteri görüldüğü/seçildiği anda `public.musteriler` içindeki eşleşen gerçek kayıt kullanılır.
- VKN, Ürün ID ve Proje Kartı ID aynı müşteri kayıt satırından birlikte alınır; alanlar farklı satırlardan birleştirilmez.
- Proje adı kullanıcıdan istenmez; müşteri kayıt satırındaki proje adı arka planda taşınır.
- Excel içe aktarımında yalnızca müşteri eşleşmesi yeterlidir.
