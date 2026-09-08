# V7.13 — Sipariş Giriş Formatı

Sipariş Hazırlama ekranı artık kullanıcıdan yalnızca 9 giriş kolonu ister:

- Müşteri
- Proje Adı
- Sipariş Tarihi
- Müşteri Sipariş No
- İstenilen Araç Tipi
- Açıklama
- Yükleme Firması Adı
- Alıcı Firma Cari Adı
- Teslim Firma Adres Adı

## Müşteri Listesi

Sipariş ekranına `Müşteri Listesi` indirme butonu eklendi. Bu dosya `public.musteriler` tablosundaki tüm aktif kayıtları sayfalı sorguyla çeker ve şu alanları verir:

Cari Firma ID, VKN, Ürün ID, Proje Adı, Proje Kartı ID, Firma Ünvanı, Hizmet Tipi, Alt Hizmet Tipi, ERP Proje Kodu.

## Otomatik müşteri/proje eşleştirme

Yüklenen sipariş Excel'inde `Müşteri + Proje Adı` değerleri `public.musteriler` kayıtlarıyla eşleştirilir. Eşleşen kaydın proje kartı/VKN bilgisi mevcut 20 kolonluk Sipariş Oluştur çıktısına otomatik yazılır. Bir müşteri/proje için birden fazla farklı proje kartı bulunursa satır hazır sayılmaz ve kullanıcıya uyarı gösterilir.

## Supabase 1000 kayıt sınırı

Müşteri listesi de 1000 kayıtla sınırlı kalmaması için `.range()` ile sayfalı olarak çekilir.

## Çıktı

Kullanıcı 9 kolonlu giriş dosyasını yükler; sistem teslimat eşleştirmelerini uygular ve mevcut Sipariş Oluştur ekranıyla uyumlu 20 kolonluk Excel üretir.
