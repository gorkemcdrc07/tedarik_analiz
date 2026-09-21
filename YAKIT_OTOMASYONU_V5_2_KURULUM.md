# Yakıt Otomasyonu V5.2

## Bir kerelik Supabase güncellemesi
Supabase SQL Editor'da `supabase/YAKIT_OTOMASYONU_V5_2.sql` dosyasını çalıştırın.
Bu migration `fuel_escalation_events` tablosunu ve `apply_fuel_escalation` atomik RPC fonksiyonunu oluşturur.

## V5.2 yenilikleri
- Petrol Ofisi'nde MERKEZ referansı, tabloda MERKEZ yoksa il adı satırıyla eşleşir (Eskişehir -> ESKISEHIR, Adana -> ADANA).
- Aynı eskalasyon ikinci kez uygulanmaz (SHA-256 event key + unique DB kaydı).
- Tarife payload + müşteri baz fiyatı + eskalasyon event kaydı tek PostgreSQL fonksiyonunda atomik uygulanır.
- `/finans/yakit-otomasyon-merkezi` ekranı eklendi.
- Otomasyon Merkezi son çalışma, hatalar, tarife güncellemeleri ve aktif kuralları gösterir.

## Test
1. npm start
2. Otomasyon Merkezi > Şimdi Kontrol Et
3. KWS ve CORTEVA artık MERKEZ hatası vermemeli.
4. Supabase `fuel_escalation_events` tablosunu kontrol edin.
