-- V5 için yeni kolon gerekmez.
-- Frontend mevcut kolonları kullanır: musteri_id, bolen, islem_esigi.
-- Kontrol:
SELECT m.id,m.musteri_adi,k.bolen,k.islem_esigi
FROM public.yakit_musterileri m
LEFT JOIN public.yakit_hesaplama_kurallari k ON k.musteri_id=m.id
WHERE upper(trim(m.musteri_adi))='FASDAT';
