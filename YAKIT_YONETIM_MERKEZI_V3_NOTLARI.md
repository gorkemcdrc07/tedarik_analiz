# Yakıt Yönetim Merkezi V3

Eklenenler:
- Sözleşme/kural yönetimi ve versiyon geçmişi
- Rol bazlı ekran/işlem yetkileri (admin, yönetici, operasyon, kullanıcı)
- Onay yorumları
- Onay SLA: normal / yaklaşıyor / gecikmiş
- Yakıt fiyat simülasyonu
- Yakıt fiyat geçmişi SVG grafiği
- Müşteri aktivite zaman çizelgesi
- Günlük yönetici özeti
- Otomasyon/sistem sağlık merkezi
- Hatalı kaynak için otomatik ticket üretim altyapısı
- Geri alma işlemi için ayrı onay talebi altyapısı ve karar aksiyonları
- Navbar, route ve sidebar entegrasyonu

Not: Yetkilendirme arayüz tarafında uygulanmıştır. Üretimde kritik approve/reject/rule/rollback işlemleri backend API tarafında da rol doğrulaması yapmalıdır.
