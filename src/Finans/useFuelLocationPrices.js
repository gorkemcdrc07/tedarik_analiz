import { useCallback, useEffect, useRef, useState } from "react";

const FUEL_API_BASE = (
  process.env.REACT_APP_FUEL_API_BASE_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "https://tedarik-analiz-backend.onrender.com"
).replace(/\/+$/, "");

const fuelApiUrl = (path) => `${FUEL_API_BASE}${path}`;


export const LOCATION_PRICES_KEY = "odak_yakit_location_prices_v1";
export const LOCATION_HISTORY_KEY = "odak_yakit_location_history_v1";
export const locationKey = (provider, city, district) => [provider,city,district,"vat-included"].map(v=>String(v).trim().toLocaleUpperCase("tr-TR")).join("|");
export const readLocationStore = (key, fallback) => { try { const value=JSON.parse(localStorage.getItem(key)||"null"); return value ?? fallback; } catch { return fallback; } };
const readObject = (key) => {const value=readLocationStore(key,{});return value && typeof value==="object" && !Array.isArray(value)?value:{}};

export default function useFuelLocationPrices(location) {
  const [prices,setPrices]=useState(()=>readObject(LOCATION_PRICES_KEY));
  const [history,setHistory]=useState(()=>{const value=readLocationStore(LOCATION_HISTORY_KEY,[]);return Array.isArray(value)?value:[]});
  const [request,setRequest]=useState({phase:"idle",types:[],finished:0,total:0,errors:{},locationId:""});
  const sequence=useRef(0),pending=useRef(new Set()),mounted=useRef(true);
  const city=location.city,district=location.district,id=`${city}|${district}`;
  const refresh=useCallback(async(type="all")=>{
    const run=++sequence.current;
    pending.current.forEach(c=>c.abort());pending.current.clear();
    const types=type==="all"?["shell","po"]:[type];
    setRequest({phase:"running",types,finished:0,total:types.length,errors:{},locationId:id});
    let finished=0;const errors={};
    await Promise.all(types.map(async(kind)=>{
      const provider=kind==="shell"?"shell":"petrol-ofisi",key=locationKey(provider,city,district);
      const controller=new AbortController();pending.current.add(controller);const timer=setTimeout(()=>controller.abort(),25000);
      try {
        const query=new URLSearchParams({provider,city:provider==="shell"&&city==="Afyonkarahisar"?"Afyon":city,district,fuel:"Motorin",vatIncluded:"true"});
        const res=await fetch(fuelApiUrl(`/api/fuel-check?${query}`),{headers:{Accept:"application/json"},cache:"no-store",signal:controller.signal});
        if(!res.headers.get("content-type")?.includes("application/json"))throw new Error("Fiyat servisine ulaşılamadı. Backend bağlantısını kontrol edin.");
        const data=await res.json();
        if(!res.ok||!data?.ok||!Number.isFinite(Number(data.price))||Number(data.price)<=0)throw new Error(data?.error||"Bu konum için fiyat bulunamadı.");
        if(!mounted.current||run!==sequence.current)return;
        const all=readObject(LOCATION_PRICES_KEY),previous=all[key];
        const at=Number.isFinite(Date.parse(data.checkedAt))?data.checkedAt:new Date().toISOString();
        const observation={key,provider,city,district,price:Number(data.price),at};
        all[key]={...observation,previous:previous?.price??null,checkedAt:at,source:data.sourceLabel||"İstasyon fiyat servisi"};
        // Location browsing is deliberately separate from customer price/baseline storage.
        localStorage.setItem(LOCATION_PRICES_KEY,JSON.stringify(all));setPrices(all);
        const stored=readLocationStore(LOCATION_HISTORY_KEY,[]),list=Array.isArray(stored)?stored:[];
        if(previous?.price>0&&Number.isFinite(Date.parse(previous.at)))list.push({key,provider,city,district,price:previous.price,at:previous.at});
        list.push(observation);const unique=new Map();list.filter(p=>p?.key&&p.price>0&&Number.isFinite(Date.parse(p.at))).forEach(p=>unique.set(`${p.key}|${p.at}`,p));
        const next=[...unique.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).slice(-12000);
        localStorage.setItem(LOCATION_HISTORY_KEY,JSON.stringify(next));setHistory(next);
      }catch(e){if(mounted.current&&run===sequence.current)errors[kind]=e.name==="AbortError"?"İstek zaman aşımına uğradı. Tekrar deneyin.":e.message;}
      finally{clearTimeout(timer);pending.current.delete(controller);finished++;if(mounted.current&&run===sequence.current)setRequest(v=>({...v,finished}));}
    }));
    if(mounted.current&&run===sequence.current)setRequest({phase:Object.keys(errors).length?"error":"success",types,finished,total:types.length,errors,locationId:id});
  },[city,district,id]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++;pending.current.forEach(c=>c.abort());};},[]);
  useEffect(()=>{refresh();return()=>{sequence.current++;pending.current.forEach(c=>c.abort());};},[refresh]);
  const priceFor=kind=>prices[locationKey(kind==="shell"?"shell":"petrol-ofisi",city,district)]||null;
  return {shell:priceFor("shell"),po:priceFor("po"),history,request,refresh,dismiss:()=>setRequest(v=>({...v,phase:"idle"})),currentRequest:request.locationId===id};
}
