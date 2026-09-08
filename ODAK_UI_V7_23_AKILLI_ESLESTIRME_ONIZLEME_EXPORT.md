# V7.23 - Akıllı eşleştirme ve önizleme Excel'i

- Sipariş Hazırla ekranındaki gereksiz Satır Ekle / Temizle aksiyonları kaldırıldı.
- Ana akış Şablon İndir -> Excel Yükle -> Excel İndir olarak sadeleştirildi.
- Tam eşleşmeyen teslim noktası ve yükleme firması değerleri kelime + karakter benzerliğiyle aranır.
- En yakın aday kullanıcıya “Bu mu?” kartıyla gösterilir; Evet onayı aynı kaynak değer geçen tüm satırlara uygulanır.
- Onaylanan alias tarayıcıda saklanır ve aynı ifade tekrar geldiğinde otomatik uygulanır.
- “Değil” seçilirse aynı aday elenir ve sonraki en güçlü aday denenir.
- Excel İndir, Sipariş Önizleme tablosunun kolonlarını ve hazırlanmış değerlerini birebir aktarır.
- Teslim Noktaları ikinci Excel sekmesi olarak korunur.
