# V43 — BİM Küsuratlı Değerler

- BİM tarife matrisinde tam sayıya yuvarlama kaldırıldı.
- Kaynak `test12345(1).xlsx` değerleri ondalıklı/küsuratlı olarak saklanır.
- İlk Fiyatlar tablosu yalnızca ham küsuratlı değeri gösterir; yuvarlanmış ikinci değer kaldırıldı.
- BİM ana tarife tablosu ve geçmiş ekranı 3 ondalık basamakla gösterilir.
- BİM yakıt eskalasyonu sonrası yeni tarifeler de tam sayıya yuvarlanmaz; ondalık hassasiyet korunur.
- V43 migration eski yuvarlanmış BİM localStorage matrisini kaynak ham tabloyla bir kez yeniler.
