# V7.23 - Akıllı eşleştirme + sade aksiyonlar + önizleme birebir Excel

- Sipariş Hazırla ana aksiyonları sadeleştirildi: Şablon İndir, Excel Yükle, Excel İndir.
- Manuel satır ekleme tablo araç çubuğuna taşındı.
- Eşleşmeyen teslim/yükleme değerlerinde kelime + karakter benzerliği ile en yakın eşleştirme kaydı önerilir.
- Kullanıcıya “Bu mu?” mantığında Evet / Değil aksiyonu gösterilir.
- Evet denirse aynı kaynak değer geçen tüm sipariş satırlarına ilgili ID'ler uygulanır.
- Kabul edilen alias eşleştirmeleri tarayıcı localStorage'ında tutulur; sonraki yüklemelerde tekrar kullanılabilir.
- Değil denirse aynı kayıt tekrar önerilmez ve sıradaki en yakın aday aranır.
- Excel İndir artık Sipariş Önizleme tablosunun kolonlarını ve satır değerlerini birebir dışarı aktarır:
  #, Müşteri, 20 teknik sipariş kolonu, Durum.
- Teslim Noktaları sekmesi dışa aktarılan Excel'de ikinci sekme olarak korunur.
