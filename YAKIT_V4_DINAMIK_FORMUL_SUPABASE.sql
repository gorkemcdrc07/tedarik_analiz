-- FASDAT / Dinamik formül V4
-- Mevcut tabloları ve fiyat kayıtlarını silmez.
ALTER TABLE public.yakit_hesaplama_kurallari
  ADD COLUMN IF NOT EXISTS formul text NOT NULL DEFAULT 'ABS(YENI_FIYAT - ESKI_FIYAT) / 1',
  ADD COLUMN IF NOT EXISTS karsilastirma_operatoru text NOT NULL DEFAULT '>=',
  ADD COLUMN IF NOT EXISTS sonuc_birimi text NOT NULL DEFAULT '%';

ALTER TABLE public.yakit_hesaplama_kurallari
  DROP CONSTRAINT IF EXISTS yakit_hesaplama_kurallari_karsilastirma_operatoru_check;
ALTER TABLE public.yakit_hesaplama_kurallari
  ADD CONSTRAINT yakit_hesaplama_kurallari_karsilastirma_operatoru_check
  CHECK (karsilastirma_operatoru IN ('>=','>','<=','<','='));

UPDATE public.yakit_hesaplama_kurallari k
SET formul='ABS(YENI_FIYAT - ESKI_FIYAT) / 1',
    karsilastirma_operatoru='>=', sonuc_birimi='%', islem_esigi=7, updated_at=now()
FROM public.yakit_musterileri m
WHERE k.musteri_id=m.id AND upper(trim(m.musteri_adi))='FASDAT';

SELECT m.id,m.musteri_adi,k.formul,k.karsilastirma_operatoru,k.islem_esigi,k.sonuc_birimi
FROM public.yakit_musterileri m
JOIN public.yakit_hesaplama_kurallari k ON k.musteri_id=m.id
WHERE upper(trim(m.musteri_adi))='FASDAT';
