# OKI irsaliye baskısı — Arial, otomatik arka plan

## Güncel yazı tipi
Baskı ve sürükle-bırak yerleşim ekranı Arial kullanır. Çok koyu / Kalın / Normal ayarları korunur. Tarayıcıda metin satırları Arial harflerinin ölçülen genişliklerine göre bölünür. Mevcut konum ayarları değiştirilmez. 75 kayıt ve uzun geniş harfli metinlerle tarayıcı baskısı kontrol edildi; taşma bulunmadı. Üretim derlemesi tamamlandı (mevcut proje uyarıları devam ediyor).


## En son eklenen: mevcut form otomatik gelir
Yerleşim / Baskı Ayarı açıldığında uygulamadaki mevcut irsaliye formu (logo, çizgiler ve başlıklar) otomatik arka plana alınır. Dosya seçmeniz gerekmez. Alanları bu formun üstüne sürükleyin ve Ayarları kaydet düğmesine basın.

Arka plan, mevcut formun boş bir görsel kopyasıdır: girilmiş veriler arka plandan kaldırılır; asıl form verileri değiştirilmez. Sadece yerleşim ekranında görünür, baskı belgesine eklenmez. Mevcut ekrandaki form temel alındığı için fiziksel matbu kağıdınız farklıysa bir deneme baskısıyla karşılaştırın.

Farklı form fotoğrafı seçme seçeneği isteğe bağlıdır. Harici fotoğrafı kaldırınca otomatik mevcut forma geri dönülür.

Gerçek İrsaliye bileşeninde, HTTP üzerinden Edge tarayıcısında otomatik arka plan, iki logonun yüklenmesi, boş arka plan alanları, asıl verinin korunması ve üstünde sürükleme doğrulandı. Görsel kontrol ve üretim derlemesi başarılıdır.


## Yeni: Sayı girmeden yerleşim ve daha koyu baskı
- **Yerleşim / Baskı Ayarı** düğmesini açın. Kağıt üzerindeki alanları fareyle tutup taşıyın. Sağ alt mavi köşeden genişlik ve yüksekliği değiştirin.
- Tablo sütunlarını sağa-sola taşıyın; mavi **Tabloyu taşı** tutamacı bütün tablonun dikey yerini değiştirir. **Tablo bitişi** tutamacı tablonun alt sınırını ayarlar.
- **Son hareketi geri al** son sürüklemeyi/klavye hareketini geri alır (en fazla 30 hareket). Yakınlaştırma %75–200 arasındadır. Kağıdın alt kısmına kaydırarak ulaşın.
- Seçili alanda ok tuşları 0,1 mm, Shift + ok 1 mm hareket sağlar. Sayısal ölçüler Gelişmiş ölçü ayarları altında isteğe bağlı tutulur.
- Hazır formun kağıt kenarlarına kadar kırpılmış PNG/JPG/WebP fotoğrafını referans olarak ekleyebilirsiniz. Fotoğraf soluk arka plan olarak yalnızca düzenleyicide görünür; normal baskıya dahil edilmez ve tarayıcıya kalıcı kaydedilmez. Görsel fiziksel kağıt ölçüsüne yayılır; perspektifli fotoğraf tam ölçüm referansı değildir.
- Düzenleyici dolu alanlarda mevcut veriyi, boş alanlarda alan adını gösterir. Tablo için ilk dolu kaydı gösterir; tüm kayıtların gerçek sayfalamasını OKI Önizle / Yazdır ekranından kontrol edin.
- **Ayarları kaydet** düğmesine basın. Yerleşim ve baskı koyuluğu tarayıcıda saklanır. Eski konum ayarları kullanılmaya devam eder.
- Varsayılan yazı artık **Çok koyu**: Arial 700 kalınlık + 0,25 px siyah kontur. Ayrıca Kalın ve Normal seçenekleri vardır. Bu seçenek baskıdaki harf kalınlığını değiştirir; yazıcı donanımının vurma şiddetini kontrol etmez. Fiziksel OKI baskısı bu ortamda denenemedi.
- Alan çakışmaları düzenleyicide gösterilir; geçersiz yerleşim kaydedilmez veya yazdırılmaz.

Görsel düzenleyici: src/Irsaliye/LayoutEditor.js ve LayoutEditor.css. Baskı bağlantısı ve kalınlık ayarları Irsaliye.js, PrintSettings.js ve dotMatrixPrint.js içinde güncellendi.

Doğrulama: Edge üzerinde sürükleme, boyutlandırma, geri alma, %150 yakınlaştırmada koordinatlar, sütun ve tablo hareketi, kaydetme/yeniden açma, koyuluk seçimi test edildi. Üretim derlemesi tamamlandı; yeni dosyalar ESLint kontrolünden geçti. Koyu yazıyla 75 kayıt / 3 sayfa testinde taşma bulunmadı.


## Kullanım
1. Uygulamada İrsaliye sayfasını açın. Excel içe aktarma veya mevcut form ile verileri girin.
2. Baskı Ayarı bölümünde kağıdın gerçek enini ve boyunu girin. Başlangıç profili A4 (210 × 297 mm), Arial 10 pt'dir; bu ölçü tüm OKI modelleri veya sürekli formlar için evrensel değildir.
3. Basılacak alanları seçin. X/Y ve genişlik/yükseklik değerleri milimetredir. X sağa, Y aşağıya doğru artar. Satır yüksekliği metin satırının yüksekliğidir; kayıtlar arası boşluk ayrıca uygulanır.
4. Kalibrasyon önizlemesini boş kağıda basın. Alan kutularını hazır form ile karşılaştırıp konumları ayarlayın. Kalibrasyon normal verileri basmaz.
5. Ayarları kaydet ile bu tarayıcıda saklayın. Kaydetmeden yapılan değişiklikler mevcut önizlemede kullanılır, sayfa yenilendiğinde korunmaz.
6. OKI Önizle / Yazdır ile yalnızca seçili verileri görün. Ayrı penceredeki Yazdır düğmesine basın. Yazıcı sürücüsünde aynı kağıt ölçüsünü seçin; ölçek %100 / gerçek boyut, kenar boşluğu yok, üstbilgi-altbilgi kapalı olmalıdır. Kağıda sığdır seçeneği konumları değiştirir.
7. Çok sayfalı çıktı her sayfada ayrı hazır form kullanır. Ortak üst/alt bilgiler ve girilmiş tutarlar her sayfada aynı şekilde tekrar basılır; bunlar sayfa bazında hesaplanmış toplamlar değildir.

Uzun tablo değerleri yazı küçültülmeden sabit aralıklı satırlara bölünür. Bir kayıt sayfalar arasında parçalanmaz. Sabit alanlarda taşma veya alan çakışması varsa baskı durdurulur; alan ölçüsünü düzeltin. Tablonun bitiş yüksekliği alt bilgilerden önce olmalıdır. Sadece seçilen alanlarda veri yoksa boş baskı açılmaz.

Ana uygulamada tarayıcının doğrudan yazdır menüsü yerine OKI düğmesini kullanın. Doğrudan yazdırma, yanlışlıkla ekran şablonunu basmamak için yönlendirme metni gösterir. Ayrı önizleme penceresinde tarayıcının yazdır menüsü kullanılabilir.

Bu çözüm tarayıcı ve Windows yazıcı sürücüsü üzerinden çalışır; ham ESC/P veya yazıcının yerleşik karakter modu değildir. Fiziksel yazıcı/form temin edilmediğinden gerçek kağıttaki son hizalama doğrulanmamıştır. Türkçe karakterleri içeren bir deneme baskısı yapın.

## İncelenen uygulama
- React / Create React App. Sayfa: `src/Irsaliye/Irsaliye.js`; yol: `/Irsaliye`, `src/App.js` içinde mevcut yetki düzeni ile açılır.
- Görünüm: `src/Irsaliye/Irsaliye.css`. Önceden çok sayıda global `@media print` / `@page` kuralı, ayrı bir gizli `irs-preprinted-print-layer` ve ayrıca Blob penceresinde oluşturulan ikinci OKI çıktısı vardı.
- Önceki aktif çıktı A4 ve mutlak mm koordinatları kullanıyordu; satırlar 57,5 mm'den 5,2 mm aralıkla sınırsız ilerliyordu. `overflow:hidden` ve tek satır metinler uzun verileri kesebiliyordu. İlk kullanımda `Number(null)` nedeniyle yazı boyutu 0 olabiliyordu.
- `FitInput` ile ekran girişleri yaklaşık 3–7,2 px arasında küçültülüyor. Ekrandaki bu mevcut davranış korundu; yeni baskı bu ölçümleri kullanmaz.
- Projenin diğer kaynaklarında ayrı bir `window.print`, jsPDF, html2canvas veya react-to-print uygulaması bulunmadı. Excel dışa aktarımları yazdırma akışından bağımsız bırakıldı.

## Mevcut veriler
Tablo kayıtları: `irsaliyeNo`, `alici`, `aliciIlce`, `paletTipi`, `miktar`, `birim` (baskıda miktarla birleştirilir).

Üst bilgiler: `ilKodu`, `seriSiraNo`, `seferNo`, `duzenlemeTarihi`, `fiiliSevkTarihiSaati`, `faturaNo`, `cikisMerkezi`, `gonderen`, `tevdiEden`.

Teslim ve not alanları: `soforeTeslimEden`, `soforeTeslimTarihSaat`, `soforImza`, `teslimAlan`, `teslimAlanTarihSaat`, `not`, `teslimEdenImza`, `teslimAlanImza`, `teslimAlanSurucu`.

Araç/sürücü: `sahibi`, `plaka`, `ruhsatNo`, `verYeri`, `surucuAdSoyad`, `ehliyetNo`, `ehliyetVerildigiYer`, `plakaNo`, `romorkPlakasi`.

Finans: `nakliyeTutari`, `kdv`, `toplam`, `motorinAvansi`, `nakitAvans`, `sigorta`, `bakiye`, `yaziIle`. Tutarlar olduğu gibi kullanılır; yeni hesaplama yapılmaz. `tevdiEden` durum modelinde mevcut olsa da ekrandaki tevdi değeri `gonderen` alanından gösterilir.

Excel şablonu 18 sütun içerir: Sefer No, Düzenleme Tarihi, Fiili Sevk Tarihi/Saati, Fatura No, Çıkış Merkezi, Gönderen, İrsaliye No, Alıcı, Alıcı/İlçe, Palet Tipi, Miktar, Şoföre Malı Teslim Eden Tarih ve Saat, Şoför Adı ve Soyadı, Plaka No, Teslim Alan - Sürücü, Nakliye Tutarı, KDV, Toplam. İçe aktarma ayrıca birim ve römork başlıklarını tanır. Ortak bilgiler ilk veri satırından alınır; mevcut eşleme ve tarih dönüşümü değiştirilmedi.

Varsayılan baskı önceki aktif çıktının 13 ortak alanı ile beş tablo sütununu içerir. Ek olarak römork, seri sıra no, il kodu, teslim eden/alan, teslim alma tarihi ve not alanları ayarlardan açılabilir. Başka form alanları bu profilde basılmaz. Ek alanların başlangıç konumlarını hazır formunuza göre ayarlayın; çakışmalar doğrulama ile yakalanır.

## Değişen dosyalar
- `src/Irsaliye/Irsaliye.js`: tek baskı modülüne bağlantı; yeni ayar paneli; eski Blob baskı kodu ve gizli ikinci katman kaldırıldı. Veri girişi, Excel işlemleri ve temizleme korundu.
- `src/Irsaliye/Irsaliye.css`: eski global baskı blokları kaldırıldı; ekran stilleri korundu.
- `src/Irsaliye/dotMatrixPrint.js`: mm düzeni, seçili alanlar, doğrulama, satır bölme, sayfalama, güvenli HTML metni ve bağımsız önizleme.
- `src/Irsaliye/PrintSettings.js` ve `.css`: alan/kağıt ayarları ve kalibrasyon.
- `scripts/test-dot-matrix.cjs`, `package.json`: `npm run test:print` kontrolü.

## Doğrulama
- Otomatik kontroller: yeni/bozuk/eski tarayıcı ayarları, 0 punto düzeltmesi, Türkçe metin, sıfır miktar, boş baskı, uzun alan, kağıt sınırı, çakışma, alan seçimi, HTML kaçışları ve bağımsız kalibrasyon.
- 75 kayıt üç sayfaya bölündü; kayıtların her biri bir kez yer aldı. Ortak bilgiler her sayfada tekrarlandı.
- Edge tarayıcısında gerçek font ölçümleriyle taşma bulunmadı. Ayrı önizleme açılışı, font hazır kontrolü ve Yazdır düğmesinin çağrısı doğrulandı; fiziksel yazdırma yapılmadı.
- PDF çıktısında üç A4 sayfa ve son kayıt doğrulandı.

## Paket
Kaynak proje, mevcut yapılandırmalar ve kilit dosyaları korunur. `node_modules`, derleme çıktıları, `.git`, `.vs` gibi bağımlılık ve geliştirme önbellekleri teslim ZIP'ine alınmaz. Bağımlılıkları kurmak için proje kökünde `npm ci`, sunucu için gerekirse `npm --prefix server ci`; çalıştırma komutu mevcut `npm start` komutudur.

Üretim derlemesi başarıyla tamamlandı (react-scripts build). Projenin mevcut kod uyarıları ve eski Browserslist verisi uyarısı devam ediyor. Yeni dotMatrixPrint.js ve PrintSettings.js dosyaları son değişiklikten sonra ESLint kontrolünden uyarısız geçti; baskı testleri tekrar başarılı oldu. Diğer 125 mevcut dosyanın orijinal arşivle birebir aynı olduğu doğrulandı.
