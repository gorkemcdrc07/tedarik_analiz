-- Yeni Sipariş > Müşteriler paneli
-- Hedef Supabase projesi: Tedarik-Analiz (cnakyamdydqxistdavfg)

create extension if not exists pgcrypto;

create table if not exists public.musteriler (
    id uuid primary key default gen_random_uuid(),
    firma_unvani text not null,
    vkn varchar,
    proje_adi text not null default '',
    urun text not null default '',
    adres text,
    telefon varchar,
    email text,
    aktif boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    proje_karti_id text,
    constraint musteriler_firma_proje_urun_key unique (firma_unvani, proje_adi, urun)
);

create index if not exists idx_musteriler_musteri_adi on public.musteriler (firma_unvani);
create index if not exists idx_musteriler_vkn on public.musteriler (vkn);
create index if not exists idx_musteriler_proje on public.musteriler (proje_adi);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_musteriler_updated_at on public.musteriler;
create trigger trg_musteriler_updated_at
before update on public.musteriler
for each row execute function public.set_updated_at();

alter table public.musteriler enable row level security;

drop policy if exists "musteriler_select_authenticated" on public.musteriler;
create policy "musteriler_select_authenticated"
on public.musteriler for select
to anon, authenticated
using (true);

drop policy if exists "musteriler_insert_authenticated" on public.musteriler;
create policy "musteriler_insert_authenticated"
on public.musteriler for insert
to anon, authenticated
with check (true);

drop policy if exists "musteriler_update_authenticated" on public.musteriler;
create policy "musteriler_update_authenticated"
on public.musteriler for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "musteriler_delete_authenticated" on public.musteriler;
create policy "musteriler_delete_authenticated"
on public.musteriler for delete
to anon, authenticated
using (true);
