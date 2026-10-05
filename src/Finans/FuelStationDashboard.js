import React, { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, Check, Clock3, Fuel, MapPin, RefreshCw, Search, Settings2, Users, Wallet, X, ChevronDown } from "lucide-react";
import "./FuelStationDashboard.css";
import FuelPriceTrend from "./FuelPriceTrend";
import useFuelLocationPrices from "./useFuelLocationPrices";
import locationsData from "./turkeyLocations.json";

const positive = (n) => n !== null && n !== "" && Number.isFinite(Number(n)) && Number(n) > 0;
const format = (n) => positive(n) ? Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
const stamp = (s) => Number.isFinite(Date.parse(s)) ? new Date(s).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Henüz kontrol edilmedi";
const normalize = (s) => String(s || "").toLocaleUpperCase("tr-TR").replace(/[_\s]+/g, " ");
const pctText = (value) => value == null ? "Veri bekleniyor" : `${value >= 0 ? "+" : "−"}%${Math.abs(value).toFixed(2).replace(".", ",")}`;
const progress = (row) => row?.fuel.change == null || !(row.threshold > 0) ? 0 : Math.min(100, Math.abs(row.fuel.change) / row.threshold * 100);
const SEGMENTS = { "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg", "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g" };
const SHAPES = { a: "9,3 40,3 45,8 39,13 10,13 5,8", b: "42,11 47,8 47,36 42,41 37,36 39,16", c: "42,43 47,48 47,74 42,80 37,75 37,49", d: "9,76 36,76 41,82 36,87 8,87 3,82", e: "3,45 8,49 8,73 3,79 0,74 0,50", f: "3,11 8,16 8,35 3,40 0,36 0,15", g: "9,39 36,39 41,44 36,49 9,49 4,44" };

function DigitalPrice({ value, loading }) {
  const [display, setDisplay] = useState(positive(value) ? Number(value) : null);
  const previous = useRef(display);
  useEffect(() => {
    if (!positive(value)) { setDisplay(null); previous.current = null; return; }
    const target = Number(value), start = previous.current ?? target;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setDisplay(target); previous.current = target; return; }
    let raf, started;
    const tick = (now) => { if (!started) started = now; const t = Math.min((now - started) / 850, 1); const next = start + (target - start) * (1 - Math.pow(1 - t, 3)); setDisplay(next); previous.current = next; if (t < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const digits = display == null ? "--,--" : display.toFixed(2).replace(".", ",");
  return <div className={`fs-digits ${loading ? "is-reading" : ""}`} role="img" aria-label={`Motorin litre fiyatı: ${format(value)} Türk lirası`}>
    <svg viewBox={`0 0 ${digits.length * 51 - 26} 94`} aria-hidden="true">
      {digits.split("").map((digit, index) => {
        const x = digits.slice(0, index).split("").reduce((sum, char) => sum + (char === "," ? 20 : 51), 0);
        return digit === "," ? <path key={index} className="fs-segment on" d={`M${x + 2} 77h9v9l-7 7h-4l4-8h-2Z`}/> : <g key={index} transform={`translate(${x},0) skewX(-4)`}>{Object.entries(SHAPES).map(([name, points]) => <polygon key={name} points={points} className={`fs-segment ${(SEGMENTS[digit] || "").includes(name) ? "on" : ""}`}/>)}</g>;
      })}
    </svg>
  </div>;
}

function PumpHose() {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return <svg className="fs-hose" viewBox="0 0 80 480" aria-hidden="true"><defs><linearGradient id={id}><stop stopColor="#080d10"/><stop offset=".45" stopColor="#515960"/><stop offset=".58" stopColor="#22282c"/><stop offset="1" stopColor="#080d10"/></linearGradient></defs><path d="M62 36C20 50 27 120 25 159L19 382Q15 461 42 460Q64 461 61 402L54 234" fill="none" stroke="#090d10" strokeWidth="15"/><path d="M62 36C20 50 27 120 25 159L19 382Q15 461 42 460Q64 461 61 402L54 234" fill="none" stroke={`url(#${id})`} strokeWidth="11"/><path d="M31 145L36 116L52 112L64 130L61 190L48 203L25 180Z" fill="var(--pump-color)" stroke="var(--pump-edge)" strokeWidth="3"/><path d="M40 145L51 137L52 173L42 181L36 174Z" fill="#172026"/><path d="M37 120L36 85L48 73L59 68" fill="none" stroke="#9ba4aa" strokeWidth="8"/><path d="M32 183L48 197L47 226L32 222Z" fill="#1c242a"/><path d="M36 187L42 191L42 215" fill="none" stroke="#737d83" strokeWidth="2"/></svg>;
}

function StationPump({ type, row, busy, failed, onRefresh, disabled }) {
  const shell = type === "shell", name = shell ? "Shell" : "Petrol Ofisi";
  const time = row?.fuel.live?.checkedAt || row?.fuel.live?.updatedAt;
  const ratio = progress(row);
  return <article className={`fs-pump ${type} ${busy ? "is-busy" : ""}`} aria-label={`${name} yakıt pompası`} aria-busy={busy}>
    <PumpHose/>
    <div className="fs-pump-body">
      <div className="fs-pump-cap"><img src={shell ? "/fuel-assets/shell-logo.png" : "/fuel-assets/petrol-ofisi-logo.svg"} alt=""/><b>{name}</b></div>
      <div className="fs-pump-glass">
        <div className="fs-pump-location"><span><MapPin size={13}/>{row?.fuel.ref.location || (shell ? "Afyon Merkez" : "Eskişehir Merkez")}</span><span className={`fs-led ${failed ? "error" : time ? "" : "waiting"}`}><i/>{busy ? "Kontrol" : failed ? "Hata" : time ? "Kayıtlı" : "Bekliyor"}</span></div>
        <div className="fs-price-window"><DigitalPrice value={row?.fuel.currentPrice} loading={busy}/><span>₺ / LİTRE</span></div>
        <div className="fs-diesel">MOTORİN</div>
        <div className="fs-pump-meta"><div><span>REFERANS FİYAT</span><strong>{format(row?.fuel.oldPrice)} <small>₺</small></strong></div><div className={row?.fuel.change < 0 ? "falling" : "rising"}><strong>{pctText(row?.fuel.change)}</strong><span>Son kontrol</span><small>{stamp(time)}</small></div></div>
        <div className="fs-tank"><Fuel size={14}/><div><i style={{ width: `${ratio}%` }}/></div><span>{row?.fuel.change == null ? "—" : `%${Math.round(ratio)}`}</span></div>
        <div className="fs-tank-caption">Tarife eşiğine ilerleme {row ? `· Eşik %${row.threshold}` : ""}</div>
      </div>
      <button type="button" className="fs-pump-button" onClick={() => onRefresh(type)} disabled={disabled || !row} aria-label={`${name} fiyatını yenile`}><RefreshCw size={16} className={busy ? "fs-spin" : ""}/>{busy ? "Kontrol ediliyor" : "Fiyatı yenile"}<span className="fs-button-shine"/></button>
      <div className="fs-pump-bottom"><span>{shell ? "V-POWER DIESEL" : "V/MAX DIESEL"}<small>REFERANS İSTASYON</small></span><Fuel size={38} strokeWidth={1.2}/></div>
    </div><div className="fs-pump-plinth"/>
  </article>;
}

function LoadingToast({ job, onClose }) {
  if (!job) return null;
  const done = job.phase !== "running", percentage = job.total ? Math.round(job.finished / job.total * 100) : null;
  return <div className={`fs-loading-toast ${job.phase}`} role="status" aria-live="polite">
    {done && <button type="button" className="fs-toast-close" aria-label="İşlem bildirimini kapat" onClick={onClose}><X size={16}/></button>}
    <div className="fs-mini-pump"><div className="fs-mini-cap"/><div className="fs-mini-glass"><div className={`fs-liquid ${done ? "done" : ""}`}><i/><i/><i/></div><Fuel size={26}/></div><div className="fs-mini-base"/><div className="fs-mini-hose"/></div>
    <div className="fs-loading-copy"><div className={`fs-load-ring ${done ? "done" : ""}`}>{done ? job.phase === "error" ? <AlertTriangle size={22}/> : <Check size={24}/> : percentage == null ? <RefreshCw size={22} className="fs-spin"/> : <b>%{percentage}</b>}</div><strong>{done ? job.phase === "error" ? "Kontrol tamamlanamadı" : "Fiyatlar güncellendi" : "Fiyatlar kontrol ediliyor"}</strong><span>{job.message}</span>{!done && <small>{job.total ? `${job.finished} / ${job.total} referans kontrol edildi` : "Müşteri kayıtları alınıyor"}</small>}</div>
  </div>;
}


export default function FuelStationDashboard({ rows = [], loading = false, error = "", onOpenCustomer, onReload }) {
  const [filter, setFilter] = useState("all"), [search, setSearch] = useState("");
  const [job, setJob] = useState(null);
  const [city, setCity] = useState(() => localStorage.getItem("odak_fuel_selected_city") || "İstanbul");
  const cityRecord = locationsData.cities.find(c => c.name === city) || locationsData.cities.find(c => c.name === "İstanbul");
  const districts = locationsData.districts.filter(d => d.cityId === cityRecord?.Id);
  const [district, setDistrict] = useState(() => localStorage.getItem("odak_fuel_selected_district") || "Sancaktepe");
  useEffect(() => { if (!districts.some(d => d.name === district)) setDistrict(districts[0]?.name || "Merkez"); }, [cityRecord?.Id]);
  useEffect(() => { localStorage.setItem("odak_fuel_selected_city", city); localStorage.setItem("odak_fuel_selected_district", district); }, [city, district]);
  const selectedLocation = { city: cityRecord?.name || city, district };
  const locationPrices = useFuelLocationPrices(selectedLocation);
  const running = locationPrices.request.phase === "running";
  const latest = [locationPrices.shell?.checkedAt, locationPrices.po?.checkedAt].filter(Boolean).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
  const shellBase = rows.find(r => r.fuel.key === "FASDAT");
  const poBase = rows.find(r => r.fuel.key === "KWS");
  const stationRows = [
    shellBase && { ...shellBase, fuel: { ...shellBase.fuel, ref: { ...shellBase.fuel.ref, location: `${selectedLocation.city} / ${selectedLocation.district}` }, currentPrice: locationPrices.shell?.price ?? shellBase.fuel.currentPrice, oldPrice: locationPrices.shell?.previous ?? shellBase.fuel.oldPrice, live: { ...shellBase.fuel.live, checkedAt: locationPrices.shell?.checkedAt } } },
    poBase && { ...poBase, fuel: { ...poBase.fuel, ref: { ...poBase.fuel.ref, location: `${selectedLocation.city} / ${selectedLocation.district}` }, currentPrice: locationPrices.po?.price ?? poBase.fuel.currentPrice, oldPrice: locationPrices.po?.previous ?? poBase.fuel.oldPrice, live: { ...poBase.fuel.live, checkedAt: locationPrices.po?.checkedAt } } },
  ].filter(Boolean);
  const shell = stationRows.find(r => r.fuel.key === "FASDAT"), po = stationRows.find(r => r.fuel.key === "KWS");
  const visible = rows.filter(r => (filter === "all" || (filter === "shell" ? r.fuel.ref.station === "Shell" : r.fuel.ref.station === "Petrol Ofisi")) && normalize(`${r.item.kod} ${r.item.musteri_adi} ${r.fuel.ref.location}`).includes(normalize(search)));
  const near = rows.filter(r=>r.status === "near" || r.status === "need").length;
  const refresh = async (type="all") => { setJob({phase:"running",type,total:2,finished:0,message:`${selectedLocation.city} / ${selectedLocation.district} fiyatları kontrol ediliyor`}); await locationPrices.refresh(type); };
  useEffect(() => { if (locationPrices.request.phase === "success" || locationPrices.request.phase === "error") setJob({ ...locationPrices.request, message: locationPrices.request.phase === "error" ? Object.values(locationPrices.request.errors).join(" · ") : `${selectedLocation.city} / ${selectedLocation.district} fiyatları güncellendi` }); }, [locationPrices.request.phase, locationPrices.request.finished, selectedLocation.city, selectedLocation.district]);

  return <div className="fs-dashboard">
    <header className="fs-header"><div><span className="fs-eyebrow">FİNANS / AKARYAKIT</span><h1>Yakıt Yönetimi</h1><p>Seçili konumun motorin fiyatlarını ve müşteri tarifelerini yönetin.</p></div><div className="fs-location-picker"><label><MapPin size={14}/> İl<select value={city} onChange={e=>{setCity(e.target.value);setDistrict("");}}>{locationsData.cities.map(c=><option key={c.Id} value={c.name}>{c.name}</option>)}</select><ChevronDown size={13}/></label><label><MapPin size={14}/> İlçe<select value={district} onChange={e=>setDistrict(e.target.value)}>{districts.map(d=><option key={d.name} value={d.name}>{d.name}</option>)}</select><ChevronDown size={13}/></label></div><div className="fs-header-right"><div className="fs-date"><CalendarDays size={23}/><div><b>{new Date().toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"})}</b><span>Son kontrol · {stamp(latest)}</span></div></div><button type="button" className="fs-refresh-all" onClick={()=>refresh("all")} disabled={running || loading || !stationRows.length}><RefreshCw size={16} className={running ? "fs-spin" : ""}/>{running ? "Kontrol ediliyor" : "Tümünü yenile"}</button></div></header>
    {error && <div className="fs-error" role="alert"><AlertTriangle size={19}/><span>{error}</span><button type="button" onClick={onReload} disabled={loading}>Tekrar dene</button></div>}
    <div className="fs-hero-grid"><div className="fs-pumps"><StationPump type="shell" row={shell} busy={running && (job?.type === "shell" || job?.type === "all")} disabled={running || loading} onRefresh={refresh}/><StationPump type="po" row={po} busy={running && (job?.type === "po" || job?.type === "all")} disabled={running || loading} onRefresh={refresh}/></div><div className="fs-analysis"><FuelPriceTrend location={selectedLocation} history={locationPrices.history} shell={locationPrices.shell} po={locationPrices.po} loading={running}/>
    </div></div>
    <section className="fs-metrics" aria-label="Yakıt yönetimi özeti"><div><span className="fs-metric-icon"><Users size={23}/></span><div><b>{rows.length}</b><span>Aktif müşteri</span></div><small>Tanımlı referanslar</small></div><div><span className="fs-metric-icon"><Wallet size={23}/></span><div><b>{rows.length}</b><span>Müşteri tarifesi</span></div><small>Alış ve satış</small></div><div><span className="fs-metric-icon warning"><AlertTriangle size={23}/></span><div><b>{near}</b><span>Eşiğe yakın / aşan</span></div><small>Kontrol bekleyen</small></div><div className="fs-tracking"><span className="fs-metric-icon"><Settings2 size={23} className={running ? "fs-spin" : ""}/></span><div><b>{running ? "Kontrol sürüyor" : "Yakıt takibi"}</b><span>{latest ? "Kayıtlı fiyatlar gösteriliyor" : "İlk fiyat kontrolü bekleniyor"}</span></div></div></section>
    <section className="fs-panel fs-customers"><div className="fs-customers-top"><h2><Fuel size={20}/> Müşteri yakıt tarifeleri</h2><div className="fs-customer-controls"><label className="fs-search"><Search size={16}/><input aria-label="Müşteri ara" placeholder="Müşteri veya konum ara…" value={search} onChange={e=>setSearch(e.target.value)}/>{search && <button type="button" aria-label="Aramayı temizle" onClick={()=>setSearch("")}><X size={14}/></button>}</label><div className="fs-tabs" aria-label="İstasyon filtresi">{[["all","Tümü"],["shell","Shell"],["po","Petrol Ofisi"]].map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} className={filter===id?"selected":""} onClick={()=>setFilter(id)}>{label}</button>)}</div></div></div>
      {loading ? <div className="fs-customer-grid" aria-label="Müşteriler yükleniyor">{[0,1,2,3].map(i=><div key={i} className="fs-skeleton"><i/><i/><i/></div>)}</div> : <div className="fs-customer-grid">{visible.map(row => <article key={row.item.id} className={`fs-customer ${row.status}`}><div className="fs-customer-heading"><div className="fs-customer-brand"><img src={row.fuel.ref.station === "Shell" ? "/fuel-assets/shell-logo.png" : "/fuel-assets/petrol-ofisi-logo.svg"} alt={row.fuel.ref.station}/><b>{row.fuel.key}</b></div><span className="fs-customer-state"><i/>{row.status === "need" ? "Eşik aşıldı" : row.status === "near" ? "Eşiğe yakın" : row.status === "waiting" ? "Bekliyor" : "Normal"}</span></div><p className="fs-customer-location">{row.fuel.ref.location}{row.fuel.key === "BİM" ? " · KDV hariç" : ""}</p><div className="fs-customer-middle"><div><span>Motorin fiyatı</span><strong>{format(row.fuel.currentPrice)} <small>₺</small></strong><em>{pctText(row.fuel.change)}</em></div><div className="fs-gauge" style={{"--gauge":`${progress(row)*3.6}deg`}} role="img" aria-label={`Tarife eşiğine ilerleme yüzde ${Math.round(progress(row))}`}><span>{row.fuel.change == null ? "—" : `%${Math.round(progress(row))}`}</span></div></div><div className="fs-customer-track-label"><span>Tarife eşiğine ilerleme</span><b>Eşik %{row.threshold}</b></div><div className="fs-customer-track"><i style={{width:`${progress(row)}%`}}/></div><button type="button" className="fs-inspect" onClick={()=>onOpenCustomer(row.item)}>Tarifeyi incele <ArrowRight size={15}/></button></article>)}</div>}
      {!loading && !visible.length && <div className="fs-empty"><Search size={25}/><b>{rows.length ? "Aramanızla eşleşen müşteri yok" : "Henüz müşteri kaydı bulunamadı"}</b>{rows.length ? <button type="button" onClick={()=>{setSearch("");setFilter("all");}}>Filtreleri temizle</button> : <button type="button" onClick={onReload}>Kayıtları yenile</button>}</div>}
    </section>
    <footer className="fs-footer"><span><b>ODAK LOJİSTİK</b> / Yakıt yönetimi</span><span><Clock3 size={12}/> Referans fiyatlar istasyona göre değişir</span></footer>
    <LoadingToast job={job || (loading ? {phase:"running",total:0,finished:0,message:"Müşteri kayıtları yükleniyor"} : null)} onClose={()=>setJob(null)}/>
  </div>;
}
