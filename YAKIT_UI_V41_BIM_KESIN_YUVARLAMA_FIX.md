# V41 — BİM kesin yuvarlama düzeltmesi

BİM tarife matrisi `test12345.xlsx` ham ondalıklı değerlerinden yeniden yüklenir.

Kural:
- küsurat 0,500 ve üzeri: yukarı
- küsurat 0,500 altı: aşağı

Örnekler:
- 20.802,311 -> 20.802
- 8.295,916 -> 8.296
- 41.482,499 -> 41.482
- 41.482,500 -> 41.483

Yakıt litre fiyatları bu yuvarlamaya dahil değildir.
