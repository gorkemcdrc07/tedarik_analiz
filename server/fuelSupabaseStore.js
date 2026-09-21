const fetch = require('node-fetch');

function cfg(){
 const url=(process.env.SUPABASE_URL||process.env.REACT_APP_SUPABASE_URL||'').replace(/\/$/,'');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
 return {url,key,enabled:Boolean(url&&key)};
}
async function req(path,{method='GET',body,headers={}}={}){
 const c=cfg(); if(!c.enabled) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil');
 const r=await fetch(`${c.url}/rest/v1/${path}`,{method,headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json',Prefer:'return=representation',...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{data=text}
 if(!r.ok) throw new Error(`Supabase ${r.status}: ${typeof data==='string'?data:JSON.stringify(data)}`); return data;
}
const q=s=>encodeURIComponent(s);
async function listRules(){return req('fuel_customer_rules?active=eq.true&select=*&order=customer.asc');}
async function listAllRules(){return req('fuel_customer_rules?select=*&order=customer.asc');}
async function upsertRule(rule){return req('fuel_customer_rules?on_conflict=customer',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:rule});}
async function getTariff(customer){const x=await req(`fuel_tariff_state?customer=eq.${q(customer)}&select=*`);return x?.[0]||null;}
async function upsertTariff(row){return req('fuel_tariff_state?on_conflict=customer',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:row});}
async function snapshot(row){return req('fuel_price_snapshots',{method:'POST',body:row});}
async function addRun(row){return req('fuel_automation_runs',{method:'POST',body:row});}
async function notify(row){return req('fuel_notifications',{method:'POST',body:row});}
async function recentRuns(){return req('fuel_automation_runs?select=*&order=started_at.desc&limit=20');}
async function recentNotices(){return req('fuel_notifications?select=*&order=created_at.desc&limit=100');}

async function applyEscalation(args){
 return req('rpc/apply_fuel_escalation',{method:'POST',body:{
  p_event_key:args.eventKey,p_customer:args.customer,p_kind:args.kind,p_payload:args.payload,
  p_base_price:args.basePrice,p_current_price:args.currentPrice,p_change_rate:args.changeRate,
  p_applied_rate:args.appliedRate,p_tariff_version:args.tariffVersion
 }});
}
async function recentEvents(){return req('fuel_escalation_events?select=*&order=created_at.desc&limit=100');}
async function updateRule(customer,patch){return req(`fuel_customer_rules?customer=eq.${q(customer)}`,{method:'PATCH',body:{...patch,updated_at:new Date().toISOString()}});}
module.exports={cfg,listRules,listAllRules,upsertRule,getTariff,upsertTariff,snapshot,addRun,notify,recentRuns,recentNotices,recentEvents,applyEscalation,updateRule};
