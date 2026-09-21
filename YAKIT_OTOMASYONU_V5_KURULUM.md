# Yakıt Otomasyon Motoru V5

## Amaç
Tarayıcı/localStorage bağımlılığını kaldırıp günlük 10:00 kontrolünü backend + Supabase üzerinde 7/24 çalıştırmak.

## Bir kerelik kurulum
1. Supabase SQL Editor'da `supabase/YAKIT_OTOMASYONU_V5.sql` dosyasını çalıştırın.
2. `server/.env` içine aşağıdakileri ekleyin:
   SUPABASE_URL=https://PROJE.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=... (Supabase service_role; ASLA React .env içine koymayın)
3. Server'ı yeniden başlatın.
4. Uygulamayı bir kez açın. V5 frontend köprüsü BİM/CMC/Corteva/Efor/ETİ/KWS/Teverpan localStorage tarifelerini merkezi `fuel_tariff_state` tablosuna aktarır.
5. `/api/fuel-automation/seed` ilk kuralları otomatik oluşturur; status isteği de boş tabloda seed eder.

## Çalışma
Her gün 10:00 Europe/Istanbul: fiyat çekilir -> snapshot -> baz fiyatla karşılaştırma -> kural -> merkezi tarife güncelleme -> baz ilerletme -> bildirim/log.
Kural sağlanmazsa baz ilerlemez. Kaynak fiyat alınamazsa tarife değişmez.
