const cron=require('node-cron');
const crypto=require('crypto');
const tls=require('tls');
const store=require('./fuelSupabaseStore');

function smtpCfg(){
 const host=process.env.FUEL_SMTP_HOST||process.env.SMTP_HOST||'smtp.office365.com';
 const port=Number(process.env.FUEL_SMTP_PORT||process.env.SMTP_PORT||587);
 const user=process.env.FUEL_SMTP_USER||process.env.SMTP_USER||'';
 const pass=process.env.FUEL_SMTP_PASS||process.env.SMTP_PASS||'';
 const from=process.env.FUEL_MAIL_FROM||process.env.SMTP_FROM||user;
 const to=(process.env.FUEL_ALERT_EMAIL_TO||'').split(/[;,]/).map(x=>x.trim()).filter(Boolean);
 return {host,port,user,pass,from,to,enabled:Boolean(host&&port&&user&&pass&&from&&to.length)};
}
function sendSmtpMail({subject,text}){
 const c=smtpCfg(); if(!c.enabled)return Promise.resolve({sent:false,reason:'FUEL_ALERT_EMAIL_TO / SMTP ayarları eksik'});
 return new Promise((resolve,reject)=>{
  const net=require('net'); let socket=net.createConnection(c.port,c.host),buf='',secure=false;
  const read=()=>new Promise((res,rej)=>{const onData=d=>{buf+=d.toString();if(/\r\n$/.test(buf)){const x=buf;buf='';socket.off('data',onData);/^([45])/.test(x)?rej(new Error(x.trim())):res(x)}};socket.on('data',onData);socket.once('error',rej)});
  const write=async(cmd)=>{socket.write(cmd+'\r\n');return read()};
  (async()=>{try{
   await read(); await write(`EHLO ${c.host}`); await write('STARTTLS');
   socket=tls.connect({socket,servername:c.host}); await new Promise((r,j)=>{socket.once('secureConnect',r);socket.once('error',j)}); buf='';
   await write(`EHLO ${c.host}`); await write('AUTH LOGIN'); await write(Buffer.from(c.user).toString('base64')); await write(Buffer.from(c.pass).toString('base64'));
   await write(`MAIL FROM:<${c.from}>`); for(const addr of c.to)await write(`RCPT TO:<${addr}>`); await write('DATA');
   const body=[`From: ${c.from}`,`To: ${c.to.join(', ')}`,`Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,`Date: ${new Date().toUTCString()}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','',text,'','.'].join('\r\n');
   await write(body); await write('QUIT').catch(()=>{}); socket.end(); resolve({sent:true,to:c.to});
  }catch(e){try{socket.destroy()}catch{} reject(e)}})();
 });
}

const DEFAULTS=[
 {customer:'BİM',provider:'Petrol Ofisi',city:'İSTANBUL',district:'SANCAKTEPE',fuel:'Motorin',vatIncluded:false,base_price:73.96,last_observed_price:73.96,threshold:0.05,factor:0.40,inclusive:true,kind:'bim',storage_key:'bim_yakit_tarifeleri',history_key:'bim_yakit_gecmisi'},
 {customer:'TEVERPAN',provider:'Petrol Ofisi',city:'TEKİRDAĞ',district:'ÇERKEZKÖY',fuel:'Motorin',base_price:96.46,last_observed_price:96.46,threshold:0.05,factor:0.50,inclusive:true,kind:'teverpan',storage_key:'teverpan_yakit_tarifeleri',history_key:'teverpan_yakit_gecmisi'},
 {customer:'EFOR ÇAY',provider:'Petrol Ofisi',city:'TOKAT',district:'ERBAA',fuel:'Motorin',base_price:90.63,last_observed_price:90.63,threshold:0.05,factor:0.50,inclusive:true,kind:'efor',storage_key:'efor_cay_yakit_tarifeleri',history_key:'efor_cay_yakit_gecmisi'},
 {customer:'CORTEVA',provider:'Petrol Ofisi',city:'ADANA',district:'MERKEZ',fuel:'Motorin',base_price:97.56,last_observed_price:97.56,threshold:0.05,factor:0.40,inclusive:false,kind:'corteva',storage_key:'corteva_yakit_tarifeleri',history_key:'corteva_yakit_gecmisi'},
 {customer:'CMC AGRO',provider:'Petrol Ofisi',city:'BURSA',district:'KARACABEY',fuel:'Motorin',base_price:96.61,last_observed_price:96.61,threshold:0.05,factor:0.50,inclusive:true,kind:'cmc',storage_key:'cmc_agro_yakit_tarifeleri',history_key:'cmc_agro_yakit_gecmisi'},
 {customer:'ETİ',provider:'Petrol Ofisi',city:'ESKİŞEHİR',district:'ODUNPAZARI',fuel:'Motorin',base_price:96.79,last_observed_price:96.79,threshold:0.10,factor:0.50,inclusive:false,kind:'eti',storage_key:'eti_yakit_tarifeleri_v2',history_key:'eti_yakit_gecmisi_v2'},
 {customer:'KWS',provider:'Petrol Ofisi',city:'ESKİŞEHİR',district:'MERKEZ',fuel:'Motorin',base_price:96.79,last_observed_price:96.79,threshold:0.12,factor:0.30,inclusive:true,kind:'kws',storage_key:'kws_yakit_tarifeleri',history_key:'kws_yakit_gecmisi'},
 {customer:'FASDAT',provider:'Shell',city:'AFYON',district:'MERKEZ',fuel:'Motorin',base_price:97.93,last_observed_price:97.93,threshold:0.07,factor:0.50,inclusive:false,kind:'fasdat',storage_key:null,history_key:null}
];
const mult=(v,r)=>typeof v==='number'?Number((v*(1+r)).toFixed(8)):v;
function transform(data,kind,rate){
 const row=(r,fields)=>Object.fromEntries(Object.entries(r||{}).map(([k,v])=>[k,fields.includes(k)?mult(v,rate):v]));
 if(kind==='bim')return (data||[]).map(r=>({...r,fiyatlar:Object.fromEntries(Object.entries(r.fiyatlar||{}).map(([k,v])=>[k,mult(Number(v),rate)]))}));
 if(kind==='teverpan')return (data||[]).map(r=>row(r,['guncelSatis']));
 if(kind==='efor')return (data||[]).map(r=>row(r,['tir']));
 if(kind==='corteva')return {satis:(data?.satis||[]).map(r=>row(r,['tir','kirkayak'])),alis:(data?.alis||[]).map(r=>row(r,['tir','kirkayak']))};
 if(kind==='cmc')return {satis:(data?.satis||[]).map(r=>row(r,['tlTon','tir','kirkayak','acikDorse'])),alis:(data?.alis||[]).map(r=>row(r,['tlTon','tir','kirkayak','acikDorse']))};
 if(kind==='eti'){const out=JSON.parse(JSON.stringify(data||{}));Object.values(out).forEach(g=>['alis','satis'].forEach(t=>{if(Array.isArray(g?.[t]))g[t]=g[t].map(r=>row(r,['fiyat']));}));return out;}
 if(kind==='kws')return {alis:(data?.alis||[]).map(r=>row(r,['ikiHaric','ikiDahil','ucHaric','ucDahil'])),satis:(data?.satis||[]).map(r=>row(r,['ikiHaric','ikiDahil','ucHaric','ucDahil'])),lowbed:(data?.lowbed||[]).map(r=>row(r,['haric','dahil']))};
 return data;
}
const pct=v=>`${v>=0?'+':''}%${(v*100).toFixed(2)}`;
async function seed({onlyMissing=true}={}){
 const existing=onlyMissing?await store.listAllRules():[];
 const names=new Set((existing||[]).map(x=>String(x.customer||'').trim().toLocaleUpperCase('tr-TR')));
 let inserted=0, skipped=0;
 for(const r of DEFAULTS){
  const key=String(r.customer).trim().toLocaleUpperCase('tr-TR');
  if(onlyMissing&&names.has(key)){skipped++;continue;}
  await store.upsertRule({...r,active:true}); inserted++;
 }
 return {inserted,skipped,total:DEFAULTS.length};
}
async function ensureSeeded(){
 const result=await seed({onlyMissing:true});
 const rules=await store.listAllRules();
 console.log(`🌱 Yakıt müşteri kuralları hazır: ${rules.length} kayıt (yeni ${result.inserted}, mevcut ${result.skipped})`);
 return {result,rules};
}
function installFuelAutomation(app,getPrice){
 let running=false;
 async function run(trigger='scheduled'){
  if(running)throw new Error('Yakıt otomasyonu zaten çalışıyor'); running=true;
  const started=new Date().toISOString(), results=[];
  try{
   let rules; try{rules=await store.listRules();if(!rules.length){await ensureSeeded();rules=await store.listRules();}}catch(e){throw new Error(`Merkezi otomasyon Supabase bağlantısı gerekli: ${e.message}`)}
   for(const r of rules){
    try{
     const current=Number(await getPrice(r));if(!Number.isFinite(current))throw new Error('Geçerli fiyat alınamadı');
     const base=Number(r.base_price||current),previous=Number(r.last_observed_price||base),change=(current-base)/base;
     const passed=r.inclusive?Math.abs(change)>=Number(r.threshold):Math.abs(change)>Number(r.threshold),applied=passed?change*Number(r.factor):0;
     await store.snapshot({customer:r.customer,provider:r.provider,city:r.city,district:r.district,fuel:r.fuel,base_price:base,previous_price:previous,current_price:current,change_rate:change,rule_passed:passed,checked_at:new Date().toISOString()});
     let tariffUpdated=false,tariffCount=0,message;
     if(passed){
      const tariff=await store.getTariff(r.customer);
      if(r.kind==='fasdat'&&!tariff?.payload){
       message=`${r.customer}: ${base.toFixed(2)} → ${current.toFixed(2)} TL (${pct(change)}). Kural sağlandı; FASDAT mevcut Supabase tarife modülü tarafından uygulanmak üzere işaretlendi.`;
      }else if(tariff?.payload){
       const next=transform(tariff.payload,r.kind,applied);tariffCount=Array.isArray(next)?next.length:Object.values(next||{}).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0);
       const eventKey=crypto.createHash('sha256').update(`${r.customer}|${base.toFixed(4)}|${current.toFixed(4)}|${applied.toFixed(8)}`).digest('hex');
       const atomic=await store.applyEscalation({eventKey,customer:r.customer,kind:r.kind,payload:next,basePrice:base,currentPrice:current,changeRate:change,appliedRate:applied,tariffVersion:Number(tariff.version||0)+1});
       const result=Array.isArray(atomic)?atomic[0]:atomic;
       tariffUpdated=Boolean(result?.applied);
       if(tariffUpdated) message=`${r.customer}: ${base.toFixed(2)} → ${current.toFixed(2)} TL (${pct(change)}). Kural sağlandı; ${pct(applied)} tarife etkisi atomik olarak uygulandı.`;
       else message=`${r.customer}: aynı eskalasyon daha önce uygulanmış; mükerrer fiyat güncellemesi engellendi.`;
      }else{
       await store.updateRule(r.customer,{last_observed_price:current,last_result:'waiting_migration',last_checked_at:new Date().toISOString()});
       message=`${r.customer}: kural sağlandı fakat merkezi tarife henüz Supabase'e aktarılmadı; güvenlik için fiyat değiştirilmedi.`;
      }
     }else{await store.updateRule(r.customer,{last_observed_price:current,last_result:'no_change',last_checked_at:new Date().toISOString()});message=`${r.customer}: ${base.toFixed(2)} → ${current.toFixed(2)} TL (${pct(change)}). Eşik sağlanmadı; tarife değişmedi.`;}
     await store.notify({customer:r.customer,title:passed?(tariffUpdated?`${r.customer} yakıt eskalasyonu uygulandı`:`${r.customer} eskalasyon kontrolü`):`${r.customer} yakıt kontrolü`,message,type:passed?(tariffUpdated?'success':'warning'):'info',action_path:'/finans/yakit-hesaplama'});
     if(tariffUpdated){try{await sendSmtpMail({subject:`${r.customer} müşteri fiyatları yakıt değişimi nedeniyle güncellendi`,text:`${message}\n\nReferans: ${r.provider} - ${r.city}/${r.district} - ${r.fuel}\nBaz fiyat: ${base.toFixed(2)} TL/L\nGüncel fiyat: ${current.toFixed(2)} TL/L\nYakıt değişimi: ${pct(change)}\nTarifeye uygulanan etki: ${pct(applied)}\nKontrol zamanı: ${new Date().toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}`});}catch(mailErr){console.error('[fuel-mail]',mailErr.message)}}
     results.push({customer:r.customer,ok:true,base,previous,current,change,threshold:Number(r.threshold),factor:Number(r.factor),passed,applied,tariffUpdated,tariffCount,message,vatIncluded:r.customer==='BİM'?false:(r.vatIncluded ?? null),priceMode:r.customer==='BİM'?'KDV hariç (+KDV)':null});
    }catch(e){await store.notify({customer:r.customer,title:`${r.customer} yakıt verisi/işlemi başarısız`,message:e.message,type:'error',action_path:'/finans/yakit-hesaplama'}).catch(()=>{});results.push({customer:r.customer,ok:false,error:e.message});}
   }
   const run={trigger,status:'completed',started_at:started,finished_at:new Date().toISOString(),results};await store.addRun(run);return run;
  }finally{running=false;}
 }
 app.get('/api/fuel-automation/live',async(req,res)=>{try{let rules=await store.listRules();if(!rules.length){await ensureSeeded();rules=await store.listRules();}const prices=[];for(const r of rules){try{const current=Number(await getPrice(r));const base=Number(r.base_price||current);const change=(current-base)/base;const passed=r.inclusive?Math.abs(change)>=Number(r.threshold):Math.abs(change)>Number(r.threshold);prices.push({customer:r.customer,provider:r.provider,city:r.city,district:r.district,fuel:r.fuel,base_price:base,current_price:current,change_rate:change,threshold:Number(r.threshold),factor:Number(r.factor),passed,checked_at:new Date().toISOString()});}catch(e){prices.push({customer:r.customer,provider:r.provider,city:r.city,district:r.district,fuel:r.fuel,error:e.message,checked_at:new Date().toISOString()});}}res.json({ok:true,prices});}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.get('/api/fuel-automation/status',async(req,res)=>{try{res.json({ok:true,mode:'supabase-v5.2',rules:await store.listRules(),runs:await store.recentRuns(),notifications:await store.recentNotices(),events:await store.recentEvents().catch(()=>[]),supabase:true});}catch(e){res.status(503).json({ok:false,mode:'supabase-v5',error:e.message,supabase:false});}});
 app.post('/api/fuel-automation/run',async(req,res)=>{try{res.json({ok:true,run:await run('manual')});}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/fuel-automation/migrate-tariff',async(req,res)=>{try{const {customer,kind,payload}=req.body||{};if(!customer||!kind||payload==null)return res.status(400).json({ok:false,error:'customer, kind, payload zorunlu'});const old=await store.getTariff(customer);const data=await store.upsertTariff({customer,kind,payload,version:Number(old?.version||0)+1,updated_at:new Date().toISOString()});res.json({ok:true,data});}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/fuel-automation/seed',async(req,res)=>{try{const result=await seed({onlyMissing:true});const rules=await store.listAllRules();res.json({ok:true,result,count:rules.length,rules});}catch(e){res.status(500).json({ok:false,error:e.message});}});
 // Backend açılır açılmaz eksik müşteri kurallarını otomatik oluştur.
 // Mevcut kayıtların kullanıcı tarafından değiştirilmiş değerlerinin üzerine yazılmaz.
 ensureSeeded().catch(e=>console.error('❌ Yakıt müşteri seed hatası:',e.message));
 cron.schedule('*/5 * * * *',()=>run('scheduled').catch(e=>console.error('[fuel-v58]',e)),{timezone:'Europe/Istanbul',noOverlap:true});
 // Render yeniden ayağa kalktığında ilk 5 dakikayı beklemeden tüm kaynakları bir kez kontrol et.
 setTimeout(()=>run('startup').catch(e=>console.error('[fuel-v58-startup]',e)),15000);
 console.log('⛽ Yakıt Otomasyon Motoru V5.8: Shell + Petrol Ofisi, tüm aktif müşteriler, 5 dakikada bir Europe/Istanbul');return{run,ensureSeeded};
}
module.exports={installFuelAutomation,DEFAULTS};
