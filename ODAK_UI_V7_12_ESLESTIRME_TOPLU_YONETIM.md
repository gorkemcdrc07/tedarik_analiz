# V7.12 - Eşleştirme Tablosu Toplu Yönetim

- Kaynak tablo: Tedarik-Analiz / public.yeni_siparis_mapping
- Mevcut aktif kayıt sayısı kontrol edildi: 1787.
- Supabase varsayılan 1000 satır sınırı sayfalı `.range()` sorguları ile aşıldı; tüm aktif kayıtlar yüklenir.
- Eşleştirme ekranına Örnek Şablon eklendi.
- Şablon kolonları: Müşteriden Gelen, Teslim Alan Firma, Teslim Firması ID, Teslim Noktası Adı, Teslim Noktası ID, Teslim Noktası İl, Teslim Noktası İlçe.
- Excel ile toplu ekleme eklendi. Dosya içi birebir tekrarlar birleştirilir; mevcut birebir kayıtlar yeniden eklenmez.
- Manuel Ekle, Düzenle ve Sil/Pasife Al işlemleri birlikte kullanılabilir.
- Arama sonucu / toplam kayıt sayısı birlikte gösterilir.
