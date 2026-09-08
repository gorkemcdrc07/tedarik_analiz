# Yeni Sipariş — Müşteriler Modülü

Yeni Sipariş ekranına **Müşteriler** butonu ve sağdan açılan müşteri yönetim paneli eklendi.

## Özellikler
- Excel ile toplu müşteri/proje/ürün yükleme (`.xlsx`, `.xls`, `.xlsm`)
- Manuel müşteri ekleme
- Müşteri kaydı düzenleme
- Kaydı pasife alma
- Firma / proje / ürün / VKN / Proje Kartı ID arama
- Excel yükleme ilerleme animasyonu
- Dark / light tema uyumu
- Yeni Sipariş müşteri ve proje seçimleri yeni tablodan beslenir
- Yeni tablo kurulu değilse ekran geçici olarak eski `Proje_Tanitim_Karti` kaynağına düşer

## Supabase migration
`supabase/migrations/20260907_create_yeni_siparis_musteriler.sql`

Yeni tablo adı: `yeni_siparis_musteriler`

Kolonlar:
- `firma_unvani`
- `proje_adi`
- `urun`
- `vkn`
- `proje_karti_id`
- `aktif`

## Excel başlıkları
Yükleyici başlık adlarındaki Türkçe karakter ve boşluk farklılıklarını normalize eder.
Önerilen başlıklar:

`Firma Ünvanı | Proje Adı | Ürün | VKN | Proje Kartı ID`

Kullanıcının verdiği eski `.xls` dosyasında algılanabilen başlıklar arasında **Firma Ünvanı** ve **Proje Adı** bulunuyor; diğer alanlar dosyada yoksa boş bırakılır.
