drop index if exists public.uq_musteriler_kayit_anahtari;
alter table public.musteriler
  drop constraint if exists musteriler_kayit_anahtari_key;
alter table public.musteriler
  add constraint musteriler_kayit_anahtari_key unique (kayit_anahtari);
