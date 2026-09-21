# V45 — BİM Nihai Tarife Yuvarlama

BİM eskalasyonunda ilk/kaynak tarife değerleri küsuratlı olarak korunur.
Yakıt değişimi ve %40 yansıtma ham değer üzerinden hesaplanır.
Yalnızca hesaplama sonunda oluşan yeni tarife standart kuralla tam TL'ye yuvarlanır:
- küsurat < 0,500: aşağı
- küsurat >= 0,500: yukarı

Örnek: 40.002,344 -> 40.002; 40.002,500 -> 40.003.
