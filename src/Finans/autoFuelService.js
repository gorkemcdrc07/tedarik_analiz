const FUEL_API_BASE=(process.env.REACT_APP_FUEL_API_BASE_URL||process.env.REACT_APP_API_BASE_URL||"https://tedarik-analiz-backend.onrender.com").replace(/\/+$/,'');
const fuelUrl=(path)=>`${FUEL_API_BASE}${path}`;
const NOTICE_KEY="odak_sistem_bildirimleri_v1", UI_KEY="odak_yakit_ui_prices_v1";
const read=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||"null");return x??f}catch{return f}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
async function readJson(res){const text=await res.text();try{return JSON.parse(text)}catch{throw new Error(`Yakıt servisi JSON döndürmedi (HTTP ${res.status}).`)}}

// Merkezi motor geçici olarak erişilemese bile bütün müşteri ekranlarının canlı kalması için
// aynı Shell / Petrol Ofisi kaynaklarını doğrudan /api/fuel-check üzerinden okuyabilen fallback listesi.
const LIVE_REFS=[
 {customer:'BİM',provider:'petrol-ofisi',providerName:'Petrol Ofisi',city:'İstanbul',district:'SANCAKTEPE',fuel:'Motorin',vatIncluded:false,reference:73.96,threshold:.05,factor:.40},
 {customer:'TEVERPAN',provider:'petrol-ofisi',providerName:'Petrol Ofisi',city:'Tekirdağ',district:'ÇERKEZKÖY',fuel:'Motorin',reference:96.46,threshold:.05,factor:.50},
 {customer:'EFOR ÇAY',provider:'petrol-ofisi',providerName:'Petrol Ofisi',city:'Tokat',district:'ERBAA',fuel:'Motorin',reference:90.63,threshold:.05,factor:.50},
 {customer:'CORTEVA',provider:'petrol-ofisi',providerName:'Petrol Ofisi',city:'Adana',district:'MERKEZ',fuel:'Motorin',reference:97.56,threshold:.05,factor:.40},
 {customer:'CMC AGRO',provider:'petrol-ofisi',providerName:'Petrol Ofisi',city:'Bursa',district:'KARACABEY',fuel:'Motorin',reference:96.61,threshold:.05,factor:.50},
 {customer:'ETİ',provider:'petrol-ofisi',providerName:'Petrol Ofisi',city:'Eskişehir',district:'ODUNPAZARI',fuel:'Motorin',reference:96.79,threshold:.10,factor:.50},
 {customer:'KWS',provider:'petrol-ofisi',providerName:'Petrol Ofisi',city:'Eskişehir',district:'MERKEZ',fuel:'Motorin',reference:96.79,threshold:.12,factor:.30},
 {customer:'FASDAT',provider:'shell',providerName:'Shell',city:'Afyon',district:'MERKEZ',fuel:'Motorin',reference:97.93,threshold:.07,factor:.50}
];

function syncLiveResult(ref,d){
 const ui=read(UI_KEY,{}),prev=ui[ref.customer]||{};
 // Referans fiyat başarılı bir tarife işlemi sonrasında ekran tarafından lastProcessedPrice olarak ilerletilir.
 const reference=Number(prev.lastProcessedPrice||prev.referencePrice||prev.old||ref.reference);
 const current=Number(d.price),change=reference>0?(current-reference)/reference:0;
 const passed=Math.abs(change)>=ref.threshold;
 ui[ref.customer]={...prev,old:reference,baseline:reference,referencePrice:reference,new:current,change,
  source:`${ref.providerName} • ${ref.city} ${ref.district} • ${ref.fuel}${ref.customer==='BİM'?' • KDV hariç (+KDV)':''}`,
  checkedAt:d.checkedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),rulePassed:passed,
  applied:passed?change*ref.factor:0,vatIncluded:ref.customer==='BİM'?false:d.vatIncluded,priceMode:d.priceMode||null,live:true};
 write(UI_KEY,ui);return {customer:ref.customer,ok:true,base:reference,current,change,threshold:ref.threshold,factor:ref.factor,passed,applied:passed?change*ref.factor:0,source:ui[ref.customer].source};
}
async function refreshOne(ref){
 const qs=new URLSearchParams({provider:ref.provider,city:ref.city,district:ref.district,fuel:ref.fuel,_t:String(Date.now())});
 if(ref.provider==='petrol-ofisi')qs.set('vatIncluded',String(ref.customer==='BİM'?false:(ref.vatIncluded??true)));
 const res=await fetch(fuelUrl(`/api/fuel-check?${qs.toString()}`),{headers:{Accept:'application/json'},cache:'no-store'});
 const d=await readJson(res);if(!res.ok||!d?.ok||!Number.isFinite(Number(d.price)))throw new Error(d?.error||`${ref.customer} canlı yakıt fiyatı alınamadı`);
 return syncLiveResult(ref,d);
}
async function refreshAllDirect(){
 const settled=await Promise.allSettled(LIVE_REFS.map(refreshOne));
 const results=settled.map((x,i)=>x.status==='fulfilled'?x.value:{customer:LIVE_REFS[i].customer,ok:false,error:x.reason?.message||'Fiyat alınamadı'});
 window.dispatchEvent(new Event('odak-fuel-updated'));
 return results;
}
function sync(status){
 const ui=read(UI_KEY,{}),latest=status?.runs?.[0]?.results||[];
 for(const r of latest){if(!r.ok)continue;const prev=ui[r.customer]||{};const oldPrice=Number(prev.lastProcessedPrice||prev.referencePrice||prev.old||r.base);ui[r.customer]={...prev,old:oldPrice,new:r.current,baseline:oldPrice,referencePrice:oldPrice,updatedAt:new Date().toISOString(),source:`${r.provider||prev.provider||'Merkezi Yakıt Otomasyonu'} • canlı`,rulePassed:r.passed,change:oldPrice&&r.current?(Number(r.current)-oldPrice)/oldPrice:r.change,applied:r.applied,message:r.message,checkedAt:new Date().toISOString(),tariffUpdated:r.tariffUpdated,vatIncluded:r.customer==='BİM'?false:r.vatIncluded,priceMode:r.customer==='BİM'?'KDV hariç (+KDV)':r.priceMode,live:true};}
 write(UI_KEY,ui);if(status?.notifications?.length)write(NOTICE_KEY,status.notifications.map(n=>({...n,action_path:n.action_path||'/yakit-hesaplama'})));window.dispatchEvent(new Event('odak-fuel-updated'));window.dispatchEvent(new Event('odak-notifications-changed'));
}
async function status(){const r=await fetch(fuelUrl('/api/fuel-automation/status'),{cache:'no-store'});const d=await readJson(r);if(!r.ok||!d.ok)throw new Error(d.error||`V5 otomasyon durumu alınamadı (HTTP ${r.status})`);return d;}
export async function runAutomaticFuelCheck(){
 const direct=await refreshAllDirect();
 try{const r=await fetch(fuelUrl('/api/fuel-automation/run'),{method:'POST'});const d=await readJson(r);if(!r.ok||!d.ok)throw new Error(d.error||'Yakıt otomasyonu çalıştırılamadı');const s=await status();sync(s);return{ok:true,results:d.run?.results||direct};}
 catch(e){console.warn('[fuel-v58] Merkezi otomasyon kullanılamıyor; Shell/PO canlı fallback devam ediyor:',e.message);return{ok:direct.some(x=>x.ok),degraded:true,results:direct};}
}
export function startFuelScheduler(){let stopped=false,timer;const poll=async()=>{try{await refreshAllDirect();try{const s=await status();if(!stopped)sync(s)}catch(e){console.warn('[fuel-v58] Merkezi durum okunamadı; direct mod devam ediyor:',e.message)}}catch(e){console.warn('[fuel-v58] Canlı fiyat taraması başarısız:',e.message)}finally{if(!stopped)timer=setTimeout(poll,300000)}};poll();return()=>{stopped=true;clearTimeout(timer)}}
export const fuelNotificationKey=NOTICE_KEY;
