# V57 — Dinamik Canlı Yakıt Fiyatı Fix
- Uygulama açılışında `/api/fuel-automation/migrate-tariff` çağrısı kaldırıldı. Render'da olmayan route artık 404 spam üretmez.
- BİM fiyatı doğrudan aynı-origin `/api/fuel-check` üzerinden Petrol Ofisi İstanbul/Sancaktepe Motorin KDV hariç (+KDV) olarak çekilir.
- İlk açılışta anında, sonrasında 5 dakikada bir canlı fiyat yenilenir.
- Merkezi Render otomasyonu mevcutsa status/run verileri ayrıca senkronlanır; mevcut değilse BİM ekranı direct modda çalışmaya devam eder.
- Manuel otomasyon tetiklemesinde de önce canlı BİM fiyatı alınır; merkezi backend 404 olsa bile fiyat ekranı güncellenir.
- Tarife/Excel/V45 yuvarlama mantığı değiştirilmedi.
