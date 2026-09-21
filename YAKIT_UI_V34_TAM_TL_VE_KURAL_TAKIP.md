# V34 — Tam TL Yuvarlama ve Net Müşteri Kuralları

- Yakıt fiyatları (örn. BİM 73,96 / 80,09) gerçek kaynak değerleriyle küsuratlı kalır.
- Tarife güncellemesi sonucu oluşan tutarlar `Math.ceil` ile bir üst tam TL'ye yuvarlanır.
- Ortak müşteri ekranında aktif kural, eşik, yansıtma oranı, formül, eski/yeni yakıt ve sonuç tek akışta gösterilir.
- Eski yakıt son işlenen değerdir; otomatik modda yeni yakıt sağlayıcı kaynağından gelir, manuel modda kullanıcı girebilir.

Kurallar (mevcut proje iş mantığı):
- FASDAT: %7'yi geçerse değişimin %50'si.
- KWS: %12 veya üzeri değişimde %30.
- ETİ: %10'u geçerse %50.
- CMC AGRO: %5 veya üzeri değişimde %50.
- CORTEVA: %5'i geçerse %40.
- EFOR ÇAY: %5 veya üzeri değişimde %50.
- TEVERPAN: %5 veya üzeri değişimde %50.
- BİM: %5 veya üzeri değişimde %40; PO İstanbul/Sancaktepe, KDV hariç (+KDV).
