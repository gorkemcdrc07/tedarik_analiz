# V38 — Standart Tam TL Yuvarlama

- Tarife ve İlk Fiyatlar tutarlarında standart yuvarlama uygulanır.
- Küsurat 0,50 ve üzerindeyse bir üst tam TL'ye, 0,50 altındaysa bir alt tam TL'ye yuvarlanır.
- Örnek: 1.422,49 → 1.422; 1.422,50 → 1.423.
- Kural mevcut/eski tarife, ilk fiyat, yeni hesaplanan tarife, geçmiş ve fark gösterimlerinde uygulanır.
- Yakıt litre fiyatları yuvarlanmaz; BİM referans 73,96 ve kaynak fiyat 80,09 gibi ondalıklı kalır.
- Son işlemi geri al ve referans/yeni yakıt senkronizasyonu V36/V37 davranışı korunur.
