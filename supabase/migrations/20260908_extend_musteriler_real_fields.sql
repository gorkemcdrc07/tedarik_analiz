-- Tedarik-Analiz / public.musteriler gerçek Excel alanları
alter table public.musteriler
  add column if not exists cari_firma_id text,
  add column if not exists urun_id text,
  add column if not exists hizmet_tipi text,
  add column if not exists alt_hizmet_tipi text,
  add column if not exists erp_proje_kodu text,
  add column if not exists kayit_anahtari text;

alter table public.musteriler
  drop constraint if exists musteriler_firma_proje_urun_key;

drop index if exists public.uq_musteriler_firma_proje_urun;

create unique index if not exists uq_musteriler_kayit_anahtari
  on public.musteriler (kayit_anahtari)
  where kayit_anahtari is not null;

create index if not exists idx_musteriler_cari_firma_id on public.musteriler (cari_firma_id);
create index if not exists idx_musteriler_urun_id on public.musteriler (urun_id);
create index if not exists idx_musteriler_proje_karti_id on public.musteriler (proje_karti_id);
create index if not exists idx_musteriler_erp_proje_kodu on public.musteriler (erp_proje_kodu);
