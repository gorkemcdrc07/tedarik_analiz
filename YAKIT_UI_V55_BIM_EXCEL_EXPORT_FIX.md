# V55 — BİM Excel Export Fix

- BİM ekranındaki tüm `Excel'e Aktar` butonları artık `exportBimPriceMemoryExcel` modern yatay tarih-bloklu raporunu kullanır.
- Eski `ESKİ ADANA / YENİ ADANA / SON DEĞİŞİM TARİHİ` kolonlu export fonksiyonu ana akıştan kaldırıldı.
- Excel düzeni: SIRA + ATIK ÇIKIŞ BÖLGESİ sabit; her dönem sağa doğru ADANA, AYDIN, ÇORLU, DENİZLİ, KAYSERİ, MARAŞ, ÇORUM bloğu olarak ilerler.
- Her dönem bloğunun üstünde tarih, Petrol Ofisi İstanbul Sancaktepe V/Max Diesel, yakıt değişim oranı, BİM eşik kuralı ve tarifeye yansıtılan oran bulunur.
