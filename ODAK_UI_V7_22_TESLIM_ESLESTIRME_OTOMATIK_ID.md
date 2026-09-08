# V7.22 - Teslim noktaları referansı ve otomatik ID eşleştirme

- Sipariş şablonuna ve 6 kolonlu dışa aktarıma `Teslim Noktaları` sekmesi eklendi.
- Sekme aktif `yeni_siparis_mapping` kayıtlarını gösterir.
- Excel `Teslim FirmaAdres Adı` değeri `musteriden_gelen` ile eşleşir:
  - `teslim_noktasi_id` -> Sipariş Hazırla / `Teslim Firma Adres Adı`
  - `teslim_firmasi_id` -> Sipariş Hazırla / `Alıcı Firma Cari Adı`
- Excel `Yükleme Firması Adı` değeri `teslim_alan_firma` ile eşleşir:
  - `teslim_firmasi_id` -> Sipariş Hazırla / `Yükleme Firması Adı`
- Kullanıcının girdiği kaynak firma/adres metinleri satır meta verisinde korunur; 6 kolonlu dışa aktarımda orijinal isimler gösterilir.
