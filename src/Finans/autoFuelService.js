const NOTICE_KEY="odak_sistem_bildirimleri_v1", UI_KEY="odak_yakit_ui_prices_v1", MIG_KEY="odak_yakit_v5_migrated";
const refs=[
 {customer:"BİM",kind:"bim",key:"bim_yakit_tarifeleri"},{customer:"TEVERPAN",kind:"teverpan",key:"teverpan_yakit_tarifeleri"},{customer:"EFOR ÇAY",kind:"efor",key:"efor_cay_yakit_tarifeleri"},{customer:"CORTEVA",kind:"corteva",key:"corteva_yakit_tarifeleri"},{customer:"CMC AGRO",kind:"cmc",key:"cmc_agro_yakit_tarifeleri"},{customer:"ETİ",kind:"eti",key:"eti_yakit_tarifeleri_v2"},{customer:"KWS",kind:"kws",key:"kws_yakit_tarifeleri"}
];
const read=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||"null");return x??f}catch{return f}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
async function migrateOnce(){
 if(localStorage.getItem(MIG_KEY)==="1")return;
 let sent=0;
 for(const r of refs){const payload=read(r.key,null);if(payload==null)continue;const res=await fetch('/api/fuel-automation/migrate-tariff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer:r.customer,kind:r.kind,payload})});if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error||`${r.customer} merkezi tarife aktarımı başarısız`);}sent++;}
 if(sent>0)localStorage.setItem(MIG_KEY,"1");
}
function sync(status){
 const ui=read(UI_KEY,{}), latest=status?.runs?.[0]?.results||[];
 for(const r of latest){if(!r.ok)continue;
  // BİM fiyatı yalnızca KDV hariç (+KDV) olarak doğrulanmış otomasyon sonucundan senkronlanır.
  // Eski Supabase çalışmaları (vatIncluded bilgisi olmayan / KDV dahil sonuçlar) ekrandaki doğru 80,09 vb. değeri ezmesin.
  if(r.customer==="BİM" && r.vatIncluded!==false) continue;
  const oldPrice=r.customer==="BİM" ? Number(ui["BİM"]?.lastProcessedPrice || ui["BİM"]?.referencePrice || 73.96) : r.base;
  ui[r.customer]={old:oldPrice,new:r.current,baseline:oldPrice,referencePrice:oldPrice,updatedAt:new Date().toISOString(),source:r.customer==="BİM"?"Petrol Ofisi • Sancaktepe • KDV hariç (+KDV)":"Merkezi Yakıt Otomasyonu V5",rulePassed:r.passed,change:r.customer==="BİM"&&oldPrice&&r.current?(Number(r.current)-oldPrice)/oldPrice:r.change,applied:r.applied,message:r.message,checkedAt:new Date().toISOString(),tariffUpdated:r.tariffUpdated,vatIncluded:r.customer==="BİM"?false:r.vatIncluded,priceMode:r.customer==="BİM"?"KDV hariç (+KDV)":r.priceMode};}
 write(UI_KEY,ui);
 if(status?.notifications?.length)write(NOTICE_KEY,status.notifications.map(n=>({...n,action_path:n.action_path||'/yakit-hesaplama'})));
 window.dispatchEvent(new Event('odak-fuel-updated'));window.dispatchEvent(new Event('odak-notifications-changed'));
}
async function status(){const r=await fetch('/api/fuel-automation/status');const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'V5 otomasyon durumu alınamadı');return d;}
export async function runAutomaticFuelCheck(){await migrateOnce();const r=await fetch('/api/fuel-automation/run',{method:'POST'});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Yakıt otomasyonu çalıştırılamadı');const s=await status();sync(s);return{ok:true,results:d.run?.results||[]};}
export function startFuelScheduler(){let stopped=false,timer;const poll=async()=>{try{await migrateOnce();const s=await status();if(!stopped)sync(s);}catch(e){console.warn('[fuel-v5]',e.message)}finally{if(!stopped)timer=setTimeout(poll,60000)}};poll();return()=>{stopped=true;clearTimeout(timer)}}
export const fuelNotificationKey=NOTICE_KEY;
