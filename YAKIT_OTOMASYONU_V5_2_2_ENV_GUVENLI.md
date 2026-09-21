# V5.2.2 ENV Güvenli Paket
- `server/.env` ZIP paketine dahil edilmez; böylece kurulum sırasında mevcut gizli Supabase anahtarları ezilmez.
- Backend `server/.env` dosyasını `__dirname` üzerinden kesin konumdan ve `override: true` ile yükler.
- `server/.env.example` yalnızca şablondur; gizli anahtar içermez.
