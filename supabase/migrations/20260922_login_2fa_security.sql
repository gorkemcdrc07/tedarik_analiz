-- V7: Login tablosu e-posta OTP alanları.
-- Mevcut kullanici_adi e-posta ise email otomatik doldurulur; diğer kullanıcıların email alanını yönetim ekranından tamamlayın.
alter table if exists public."Login" add column if not exists email text;
alter table if exists public."Login" add column if not exists aktif boolean not null default true;
alter table if exists public."Login" add column if not exists two_factor_enabled boolean not null default true;
update public."Login" set email = kullanici_adi where email is null and kullanici_adi like '%@%';
create unique index if not exists login_email_unique_idx on public."Login" (lower(email)) where email is not null;
