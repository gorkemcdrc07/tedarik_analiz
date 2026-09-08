# ODAK UI V6.2 — Dark Mode Hard Fix

Bu sürümde dark mode düzeltmeleri global CSS'te bırakılmadı. Lazy-loaded ekran CSS'leri global dark dosyasından sonra yüklendiği için, her kritik ekranın kendi CSS dosyasının en sonuna component-local dark override eklendi.

Özellikle Sipariş Oluştur ekranındaki selector, toolbar, tablo, upload satırı, input/select ve kart yüzeyleri doğrudan component CSS seviyesinde koyulaştırıldı.
