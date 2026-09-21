# V58 — Tüm Müşteriler Canlı Yakıt

- Shell ve Petrol Ofisi kaynakları backend tarafından 5 dakikada bir kontrol edilir.
- Backend açılışından 15 saniye sonra ilk toplu kontrol otomatik çalışır.
- BİM, TEVERPAN, EFOR ÇAY, CORTEVA, CMC AGRO, ETİ, KWS ve FASDAT canlı fiyat akışına bağlıdır.
- Frontend de 5 dakikada bir tüm müşteri lokasyonlarını `/api/fuel-check` üzerinden yeniler; merkezi otomasyon geçici olarak kullanılamazsa canlı fiyat fallback'i devam eder.
- BİM Petrol Ofisi fiyatı KDV hariç (+KDV) olarak korunur.
- Tarife hesaplama, V45 yuvarlama, V55 Excel ve V56 sade BİM arayüzü korunmuştur.
- Sürekli sunucu tarafı takip için bu ZIP içindeki `server` klasörünün de Render'a deploy edilmesi gerekir.
