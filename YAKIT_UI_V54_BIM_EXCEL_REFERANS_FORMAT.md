# V54 — BİM Excel Referans Format

BİM Excel fiyat hafızası, kullanıcı tarafından paylaşılan yatay tarih-bloklu referans yapısına göre düzenlendi.

- Solda yalnızca SIRA ve ATIK ÇIKIŞ BÖLGESİ sabit.
- Her tarih/güncelleme sağa doğru ayrı 7 kolonluk blok olarak ilerler.
- Her blokta aynı başlıklar tekrar eder: ADANA, AYDIN, ÇORLU, DENİZLİ, KAYSERİ, MARAŞ, ÇORUM.
- ESKİ/YENİ kolon adları kullanılmaz.
- Üst bilgi satırları: Tarih, Petrol Ofisi İstanbul Sancaktepe V/Max Diesel, Yakıt Değişim Oranı, BİM Eşik Kuralı, Tarifeye Yansıtılan Oran, Fiyat Değişim Oranı.
- Güncelleme blokları renklerle ayrılır; son güncel blok yeşil vurgulanır.
- Artış/düşüş oranları yeşil/kırmızı görsel ayrımla gösterilir.
- İlk iki kolon ve üst başlıklar dondurulur; grid çizgileri gizlenir; yatay baskı düzeni uygulanır.
- BİM tarife hesaplama ve V45 yuvarlama mantığı değiştirilmedi.
