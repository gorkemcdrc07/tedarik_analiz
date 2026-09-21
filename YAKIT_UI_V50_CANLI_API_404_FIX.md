# V50 - Canlı Fuel API 404 Fix

- Vercel üzerinde `/api/fuel-automation/*` çağrılarının CRA statik uygulamasına düşüp 404 HTML dönmesi düzeltildi.
- Frontend yakıt otomasyonu artık `REACT_APP_FUEL_API_BASE_URL`, yoksa `REACT_APP_API_BASE_URL` üzerinden backend çağrısı yapar.
- Vercel için `/api/fuel-automation/(.*)` -> Render backend rewrite eklendi.
- JSON olmayan hata sayfaları artık `Unexpected token` üretmek yerine anlaşılır servis hatası verir.
- BİM UI, tarife hesaplama ve yuvarlama mantığı değiştirilmedi.
