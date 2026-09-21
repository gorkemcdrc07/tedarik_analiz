# Yakıt Otomasyonu V5.1

- Backend açılışında `fuel_customer_rules` kontrol edilir.
- BİM, TEVERPAN, EFOR ÇAY, CORTEVA, CMC AGRO, ETİ, KWS ve FASDAT eksikse otomatik eklenir.
- Var olan müşteri kuralının üzerine seed verisi yazılmaz.
- Terminalde `Yakıt müşteri kuralları hazır: 8 kayıt` mesajı görülür.
- `POST /api/fuel-automation/seed` yalnızca eksik kayıtları tamamlar.
- `POST /api/fuel-automation/run` 10:00'u beklemeden tam otomasyonu test eder.
