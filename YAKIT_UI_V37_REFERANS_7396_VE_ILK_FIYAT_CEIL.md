# V37 — BİM Referans 73,96 + İlk Fiyat Tam TL

- BİM referans/eski yakıt fiyatı için V37 migration eklendi: 73,96 TL/LT.
- BİM canlı yeni fiyat KDV hariç Petrol Ofisi Sancaktepe kaynağından gelmeye devam eder.
- BİM tarife tablosu yüklenirken localStorage dahil tüm mevcut tutarlar Math.ceil ile tam TL'ye normalize edilir.
- İlk Fiyatlar / fiyat hafızası ekranında başlangıç, geçmiş, güncel ve fark tutarları da yukarı yuvarlanmış tam TL gösterilir.
- Yakıt litre fiyatları (73,96 / canlı fiyat) yuvarlanmaz; tarife tutarları yuvarlanır.
