# V7.15 - Sipariş satırında müşteri seçimi ve otomatik dolum

- Sipariş önizleme tablosunda Müşteri ve Proje Adı artık seçilebilir.
- Müşteri seçilince tek proje varsa proje otomatik seçilir.
- Proje seçildiği anda public.musteriler kaydından VKN, Ürün ID ve Proje Kartı ID otomatik doldurulur.
- Sipariş Oluştur çıktısındaki Proje alanı öncelikle Proje Kartı ID kullanır; yoksa ERP Proje Kodu, o da yoksa proje adı kullanılır.
- Sipariş Satırı Ekle ile Excel yüklemeden manuel satır oluşturulabilir.
- Siparişe özel alanlar ekrandan düzenlenebilir.
- Her satır silinebilir.
