-- FASDAT V6.2 - TON/TL numeric/parser uyumlu şema + RLS
-- Mevcut verileri silmez.

alter table if exists public.yakit_alis_tarifeleri drop column if exists hammadde_miktar_ton;
alter table if exists public.yakit_satis_tarifeleri drop column if exists hammadde_miktar_ton;
alter table if exists public.yakit_ton_tl_gecmisi drop column if exists hammadde_miktar_ton;

alter table if exists public.yakit_alis_tarifeleri alter column ton_tl type numeric(20,4) using ton_tl::numeric(20,4);
alter table if exists public.yakit_satis_tarifeleri alter column ton_tl type numeric(20,4) using ton_tl::numeric(20,4);
alter table if exists public.yakit_ton_tl_gecmisi alter column eski_ton_tl type numeric(20,4) using eski_ton_tl::numeric(20,4);
alter table if exists public.yakit_ton_tl_gecmisi alter column yeni_ton_tl type numeric(20,4) using yeni_ton_tl::numeric(20,4);
alter table if exists public.yakit_ton_tl_gecmisi alter column eski_yakit_fiyati type numeric(20,4) using eski_yakit_fiyati::numeric(20,4);
alter table if exists public.yakit_ton_tl_gecmisi alter column yeni_yakit_fiyati type numeric(20,4) using yeni_yakit_fiyati::numeric(20,4);
alter table if exists public.yakit_ton_tl_gecmisi alter column yakit_degisim_orani type numeric(20,8) using yakit_degisim_orani::numeric(20,8);
alter table if exists public.yakit_ton_tl_gecmisi alter column uygulanan_artis_orani type numeric(20,8) using uygulanan_artis_orani::numeric(20,8);

-- Mevcut frontend anon anahtarla çalışıyorsa tarife işlemlerine izin ver.
do $$
declare t text;
begin
 foreach t in array array['yakit_alis_tarifeleri','yakit_satis_tarifeleri','yakit_ton_tl_gecmisi'] loop
  if to_regclass('public.'||t) is not null then
   execute format('alter table public.%I enable row level security',t);
   execute format('drop policy if exists fasdat_app_all on public.%I',t);
   execute format('create policy fasdat_app_all on public.%I for all to anon, authenticated using (true) with check (true)',t);
   execute format('grant select,insert,update,delete on public.%I to anon, authenticated',t);
  end if;
 end loop;
end $$;
grant usage, select on all sequences in schema public to anon, authenticated;
