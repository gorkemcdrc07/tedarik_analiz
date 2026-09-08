# Odak Lojistik UI Yenileme – V3

Bu sürümde mevcut iş mantığı ve veri akışları korunarak uygulamanın frontend tasarım sistemi daha ileri bir seviyeye taşındı. Amaç; bütün ekranların tek bir Odak Lojistik ürün ailesi gibi görünmesi, operasyon ekranlarının daha hızlı okunması ve aksiyonların daha net anlaşılmasıdır.

## V3'te yapılanlar

- Yeni merkezi **Odak Design System V3** eklendi (`src/odak-modern-v3.css`).
- Odak kırmızısı, koyu lacivert, yüzey, border, gölge, radius, hover, focus ve durum renkleri tek sistemde standardize edildi.
- MUI kullanan ekranlar için merkezi **Odak MUI Theme** oluşturuldu (`src/theme/OdakMuiTheme.js`).
- MUI Button, IconButton, TextField, Select, Dialog, Chip, Table ve Tooltip bileşenleri Odak temasına geçirildi.
- Sidebar daha modern ikon kutuları, daha güçlü aktif durum, daha temiz logo alanı ve daha dengeli spacing ile güncellendi.
- Navbar logo, başlık, kullanıcı alanı ve global arama görünümü geliştirildi.
- Navbar arama sonuçları artık her modül için kendi lojistik/operasyon ikonunu gösteriyor.
- Normal kullanıcıların global aramasında yalnızca yetkili oldukları ekranlar gösteriliyor.
- Tüm native operasyon ekranlarında buton yüksekliği, radius, hover/active/focus davranışı ortaklaştırıldı.
- Ana aksiyonlar Odak kırmızısı; operasyonel ikincil aksiyonlar koyu lacivert; nötr aksiyonlar beyaz/gri; silme aksiyonları kontrollü kırmızı olarak standardize edildi.
- Input, select, tarih alanı ve filtrelerin yükseklik/focus tasarımları ortaklaştırıldı.
- Operasyon tabloları sticky header, daha net başlık hiyerarşisi, satır hover, zebra yoğunluğu ve modern border yapısına geçirildi.
- Parsiyel Sipariş ekranında header, metrik kartları, tablo barı, aksiyon butonları ve satır ikon butonları ayrıca iyileştirildi.
- Sipariş Oluştur ve Yeni Sipariş ekranlarının upload/dropzone, buton, seçim ve tablo alanları Odak V3 standardına taşındı.
- Teslim Noktaları ekranına `MapPinned`, `UploadCloud`, `FileSpreadsheet`, `LoaderCircle` gibi modern lojistik ikonları eklendi.
- Sefer Fiyatlandırma ekranına `Truck`, `Calculator`, `RefreshCw`, `FilterX`, `Download` ikonları ve modern toolbar hiyerarşisi eklendi.
- Gelir/Gider ana aktarım ekranlarının header, kart, buton ve dropzone tasarımları modernleştirildi; finans aksiyonlarına anlamlı ikonlar eklendi.
- Test Gelir/Test Gider ekranlarındaki emoji ikonları kaldırılıp Lucide ikonlara geçirildi.
- Sipariş Açanlar ekranındaki emoji ikonları kaldırıldı; kullanıcı, takvim ve modal aksiyonları modern Lucide ikonlarla değiştirildi.
- Özet Analiz ekranındaki emoji ikonları kaldırıldı; analiz, filtre, CSV export ve kart görünümü Odak temasına geçirildi.
- Ana dashboard hero alanı, gerçek yetkiye göre çalışan hızlı aksiyonlar ve gerçek kullanıcı/yetki metrikleriyle geliştirildi.
- Dashboard'a Parsiyel Sipariş, Sefer Fiyatlandırma ve Gelir Ekleme gibi gerçek hızlı erişimler eklendi.
- Sahte sipariş/sefer KPI verileri veya dekoratif boş kartlar eklenmedi.
- Responsive davranışlar masaüstü, tablet ve mobil için güçlendirildi.

## Teknik doğrulama

- `src` altındaki JS/JSX dosyaları TypeScript parser ile parse edildi: **syntax hatası bulunmadı**.
- Ana CSS dosyaları PostCSS parser ile kontrol edildi: **CSS parse hatası bulunmadı**.
- `node_modules`, `build`, `.git`, `.vs` ve `.env` dağıtım paketine dahil edilmez.

## Çalıştırma

Kendi mevcut `.env` dosyanızı proje kökünde koruyun ve ardından:

```bash
npm install
npm start
```

Production kontrolü için:

```bash
npm run build
```
