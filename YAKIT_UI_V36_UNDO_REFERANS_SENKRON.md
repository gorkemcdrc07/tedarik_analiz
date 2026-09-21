# V36 - Geri Al Yakıt Referans Senkronizasyonu

- Son işlem geri alındığında yalnızca tarifeler değil, o işlemin yakıt karşılaştırması da geri yüklenir.
- Eski/Referans yakıt fiyatı geçmiş kaydındaki `eski_yakit_fiyati` / `eski_yakit` değerine döner.
- Yeni yakıt fiyatı geçmiş kaydındaki `yeni_yakit_fiyati` / `yeni_yakit` değerine döner.
- `odak_yakit_ui_prices_v1` içindeki old/baseline/referencePrice/lastProcessedPrice ve new/current/currentPrice alanları aynı anda senkronize edilir.
- BİM, KWS, ETİ, TEVERPAN, EFOR ÇAY, CORTEVA, CMC AGRO ve FASDAT geri alma akışları kapsanır.
- Tarife tam TL/yukarı yuvarlama davranışı V35'ten korunur.
