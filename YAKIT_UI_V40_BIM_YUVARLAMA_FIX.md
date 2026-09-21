# V40 BİM Yuvarlama Düzeltmesi

- BİM tablosu `test12345.xlsx` içindeki ham ondalıklı değerlerden yeniden oluşturuldu.
- Kural: küsurat >= 0,50 yukarı; < 0,50 aşağı.
- Örnek: 20.802,311 -> 20.802; 8.295,916 -> 8.296.
- Türkçe biçimli metin değerleri (örn. `20.802,311`) de doğru parse edilir.
- V40 migration eski localStorage BİM tablosunu doğru yuvarlanmış kaynakla bir kez yeniler.
- Yakıt litre fiyatları bu yuvarlamaya dahil değildir.
