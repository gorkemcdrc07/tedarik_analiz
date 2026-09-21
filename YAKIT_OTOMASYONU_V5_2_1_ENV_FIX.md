# Yakıt Otomasyonu V5.2.1

- `server/.env` artık çalışma dizinine bağlı değildir; `server/index.js` dosyasının bulunduğu klasörden mutlak yol ile yüklenir.
- `npm --prefix server start`, kök `npm start` ve doğrudan `node server/index.js` senaryolarında aynı Supabase ayarları kullanılır.
- Başlangıçta yalnızca URL/KEY var-yok bilgisi yazılır; secret değerleri loglanmaz.
