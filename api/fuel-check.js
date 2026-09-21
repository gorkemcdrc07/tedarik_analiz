const trSlug = (value = "") => String(value).trim().toLocaleLowerCase("tr-TR")
  .replace(/ı/g,"i").replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ş/g,"s").replace(/ö/g,"o").replace(/ç/g,"c")
  .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const trKey = (value = "") => String(value).toLocaleUpperCase("tr-TR")
  .replace(/İ/g,"I").replace(/Ğ/g,"G").replace(/Ü/g,"U").replace(/Ş/g,"S").replace(/Ö/g,"O").replace(/Ç/g,"C").replace(/[^A-Z0-9]/g,"");
const cleanHtml = (value = "") => String(value).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g," ").trim();
const firstPrice = (value = "") => {
  const m=cleanHtml(value).replace(/,/g,".").match(/(?:^|\s)(\d{1,3}(?:\.\d{1,2}))(?:\s|TL|₺|$)/i);
  return m ? Number(m[1]) : NaN;
};
const priceList = (value = "") => (cleanHtml(value).match(/\d{1,3}(?:[.,]\d{1,2})/g) || []).map(v => Number(v.replace(",", ".")));

module.exports = async function handler(req,res) {
  if(req.method !== "GET") return res.status(405).json({ok:false,error:"Sadece GET destekleniyor."});
  try {
    const {provider="",city="",district="",fuel="Motorin"}=req.query;
    const vatIncluded=String(req.query?.vatIncluded ?? "true").toLowerCase()!=="false";
    if(provider !== "petrol-ofisi") return res.status(400).json({ok:false,error:"Bu firma için otomatik kaynak bağlı değil."});
    if(!String(city).trim() || !String(district).trim()) return res.status(400).json({ok:false,error:"İl ve ilçe zorunlu."});
    const slug=trSlug(city);
    const sourceUrl=`https://www.petrolofisi.com.tr/akaryakit-fiyatlari/${slug}-akaryakit-fiyatlari`;
    const upstream=await fetch(sourceUrl,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36","Accept":"text/html,application/xhtml+xml","Accept-Language":"tr-TR,tr;q=0.9,en;q=0.7"}});
    if(!upstream.ok) throw new Error(`Petrol Ofisi sayfası HTTP ${upstream.status} döndürdü.`);
    const html=await upstream.text();
    const wanted=trKey(district || city);
    const rows=html.match(/<tr\b[\s\S]*?<\/tr>/gi)||[];
    let cells=null;
    for(const row of rows){
      const td=row.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi)||[];
      if(!td.length) continue;
      const first=trKey(cleanHtml(td[0]));
      if(first===wanted || first.includes(wanted) || wanted.includes(first)){ cells=td; break; }
    }
    if(!cells) throw new Error(`${district} için Petrol Ofisi fiyat satırı bulunamadı.`);
    const idx={BENZIN:1,MOTORIN:2,LPG:6}[trKey(fuel)];
    if(idx==null || !cells[idx]) throw new Error(`${fuel} fiyat sütunu bulunamadı.`);
    const prices=priceList(cleanHtml(cells[idx]));
    const gross=prices[0];
    // PO bazen server-side HTML'de yalnızca KDV dahil değeri döndürüyor. KDV kapalı
    // istenmişse öncelik hücredeki son (+KDV) değerdir; yoksa %20 KDV arındırılır
    // ve PO ekranındaki kuruş yukarı yuvarlama ile net değer elde edilir (96,10 -> 80,09).
    const netFallback=Number.isFinite(gross)?Math.ceil((gross/1.20)*100-1e-9)/100:NaN;
    const price=!vatIncluded?(prices.length>1?prices[prices.length-1]:netFallback):gross;
    if(!Number.isFinite(price)||price<=0) throw new Error(`${fuel} fiyatı sayısal olarak okunamadı.`);
    res.setHeader("Cache-Control","no-store");
    return res.status(200).json({ok:true,provider:"Petrol Ofisi",city,district,fuel,price,vatIncluded,priceMode:vatIncluded?"KDV dahil":"KDV hariç (+KDV)",sourceUrl,checkedAt:new Date().toISOString()});
  } catch(err){
    return res.status(502).json({ok:false,error:err.message||"Fiyat okunamadı."});
  }
};
