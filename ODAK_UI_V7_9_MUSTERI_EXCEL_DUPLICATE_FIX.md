# V7.9 - Müşteri Excel Tekrar Kaydı Düzeltmesi

- `ON CONFLICT DO UPDATE command cannot affect row a second time` hatası giderildi.
- Excel içindeki aynı `firma_unvani + proje_adi + urun` kombinasyonları Supabase upsert öncesinde tekilleştiriliyor.
- Tekrarlanan satırlarda son dolu VKN ve Proje Kartı ID değerleri korunuyor.
- Aktarım durumunda toplam okunan satır, birleştirilen tekrar sayısı ve benzersiz kayıt sayısı gösteriliyor.
- Supabase conflict anahtarı ve mevcut CRUD yapısı değiştirilmedi.
