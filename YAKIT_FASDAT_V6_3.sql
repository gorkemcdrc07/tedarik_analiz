-- FASDAT V6.3 - ALIS TON/TL KUSURAT DUZELTMESI
-- V6/V6.1'de Excel 1480.34 -> 148034 olarak kaydedilmiş eski ALIS kayıtlarını
-- SADECE BIR KEZ /100 yapar. Tekrar çalıştırmak fiyatı tekrar bölmez.

create table if not exists public.yakit_migration_log (
  migration_key text primary key,
  applied_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from public.yakit_migration_log
    where migration_key = 'fasdat_v6_3_alis_ton_tl_decimal_fix'
  ) then
    -- Bu düzeltme sadece önceki hatalı importtan kalan ALIŞ kayıtları içindir.
    -- Örnek: 148034 -> 1480.34
    update public.yakit_alis_tarifeleri
       set ton_tl = round((ton_tl / 100.0)::numeric, 4),
           updated_at = now();

    insert into public.yakit_migration_log(migration_key)
    values ('fasdat_v6_3_alis_ton_tl_decimal_fix');
  end if;
end $$;

-- Kolon kapasitesini koru.
alter table if exists public.yakit_alis_tarifeleri
  alter column ton_tl type numeric(20,4) using ton_tl::numeric(20,4);
alter table if exists public.yakit_satis_tarifeleri
  alter column ton_tl type numeric(20,4) using ton_tl::numeric(20,4);

-- Uygulama anon/authenticated çalışıyorsa gerekli temel izinler.
grant select, insert, update, delete on public.yakit_alis_tarifeleri to anon, authenticated;
grant select, insert, update, delete on public.yakit_satis_tarifeleri to anon, authenticated;
