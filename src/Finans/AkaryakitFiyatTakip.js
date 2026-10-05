import React, { useEffect, useMemo, useState } from "react";
import { BellRing, Building2, CheckCircle2, Clock3, ExternalLink, Fuel, History, MapPin, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import "./AkaryakitFiyatTakip.css";
import { runAutomaticFuelCheck } from "./autoFuelService";

const FUEL_API_BASE = (
  process.env.REACT_APP_FUEL_API_BASE_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "https://tedarik-analiz-backend.onrender.com"
).replace(/\/+$/, "");

const fuelApiUrl = (path) => `${FUEL_API_BASE}${path}`;


const STORAGE_KEY = "odak_akaryakit_takip_v1";
const HISTORY_KEY = "odak_akaryakit_gecmis_v1";
const PROVIDERS = ["Petrol Ofisi", "Shell"];
const FUELS = ["Motorin", "Benzin", "LPG"];

const load = (key, fallback = []) => {
  try { const v = JSON.parse(localStorage.getItem(key) || "null"); return Array.isArray(v) ? v : fallback; } catch { return fallback; }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const money = (v) => Number.isFinite(Number(v)) ? `${Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : "—";
const pct = (oldV, newV) => oldV && Number.isFinite(newV) ? ((newV-oldV)/oldV)*100 : 0;
const nowText = () => new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });

export default function AkaryakitFiyatTakip() {
  const [rows, setRows] = useState(() => load(STORAGE_KEY));
  const [history, setHistory] = useState(() => load(HISTORY_KEY));
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ provider: "Petrol Ofisi", city: "", district: "", fuel: "Motorin", price: "" });

  useEffect(() => save(STORAGE_KEY, rows), [rows]);
  useEffect(() => save(HISTORY_KEY, history), [history]);
  useEffect(() => { const sync=()=>{setRows(load(STORAGE_KEY));setHistory(load(HISTORY_KEY));}; window.addEventListener("odak-fuel-updated",sync); return()=>window.removeEventListener("odak-fuel-updated",sync); }, []);

  const changed = useMemo(() => rows.filter(r => r.previousPrice != null && Number(r.previousPrice) !== Number(r.price)).length, [rows]);
  const lastCheck = useMemo(() => rows.map(r => r.checkedAt).filter(Boolean).sort().at(-1), [rows]);

  const addRow = () => {
    if (!form.city.trim() || !form.district.trim()) { setMessage("İl ve ilçe alanlarını doldurun."); return; }
    const price = form.price === "" ? null : Number(String(form.price).replace(",", "."));
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, ...form, city: form.city.trim().toLocaleUpperCase("tr-TR"), district: form.district.trim().toLocaleUpperCase("tr-TR"), price: Number.isFinite(price) ? price : null, previousPrice: null, checkedAt: null, status: "Bekliyor" };
    setRows(v => [item, ...v]);
    setModal(false); setForm({ provider: "Petrol Ofisi", city: "", district: "", fuel: "Motorin", price: "" }); setMessage("");
  };

  const applyPrice = (id, newPrice, source = "Manuel") => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const old = r.price;
      if (old != null && Number(old) !== Number(newPrice)) {
        setHistory(h => [{ id: `${Date.now()}-${r.id}`, trackerId: r.id, provider: r.provider, city: r.city, district: r.district, fuel: r.fuel, oldPrice: Number(old), newPrice: Number(newPrice), changedAt: new Date().toISOString(), source }, ...h]);
      }
      return { ...r, previousPrice: old, price: Number(newPrice), checkedAt: new Date().toISOString(), status: old != null && Number(old) !== Number(newPrice) ? "Değişti" : "Güncel" };
    }));
  };

  const checkOne = async (row) => {
    try {
      const qs = new URLSearchParams({ provider: row.provider === "Shell" ? "shell" : "petrol-ofisi", city: row.city, district: row.district, fuel: row.fuel });
      const res = await fetch(fuelApiUrl(`/api/fuel-check?${qs}`), { headers: { Accept: "application/json" } });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); }
      catch { throw new Error(`Yakıt API JSON döndürmedi (HTTP ${res.status}). Backend'in 5000 portunda çalıştığını kontrol edin.`); }
      if (!res.ok || !data?.ok || !Number.isFinite(Number(data.price))) throw new Error(data?.error || "Fiyat okunamadı");
      applyPrice(row.id, Number(data.price), data.sourceLabel || `${row.provider} resmi fiyat sayfası`);
      return { ok: true };
    } catch (e) { return { ok: false, reason: e.message }; }
  };

  const checkAll = async () => {
    if (!rows.length) { setMessage("Önce takip edilecek bir lokasyon ekleyin."); return; }
    setBusy(true); setMessage(""); let ok=0, fail=0; const errors=[];
    for (const row of rows) { const result = await checkOne(row); if (result.ok) ok++; else { fail++; errors.push(`${row.provider} ${row.city}/${row.district}: ${result.reason}`); } }
    try { await runAutomaticFuelCheck(true); } catch (_) {}
    setBusy(false); setMessage(`${ok} kayıt kontrol edildi${fail ? `, ${fail} kayıt otomatik kontrol edilemedi` : ""}.${errors.length ? ` • ${errors.join(" • ")}` : ""} Müşteri eskalasyon kuralları da kontrol edildi.`);
  };

  const manualUpdate = (row) => {
    const value = window.prompt(`${row.provider} • ${row.city}/${row.district} • ${row.fuel}\nYeni litre fiyatı:`, row.price ?? "");
    if (value == null) return;
    const n = Number(String(value).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) { setMessage("Geçerli bir fiyat girin."); return; }
    applyPrice(row.id, n, "Manuel giriş");
  };

  return <div className="aft-page">
    <div className="aft-hero">
      <div><div className="aft-kicker"><Fuel size={16}/> AKARYAKIT İZLEME MERKEZİ</div><h1>Akaryakıt Fiyat Takip</h1><p>Petrol Ofisi ve Shell için seçtiğiniz lokasyonları tek ekrandan takip edin; fiyat değişimlerini geçmişiyle görün.</p></div>
      <div className="aft-actions"><button className="aft-btn ghost" onClick={() => setModal(true)}><Plus size={18}/> Takip Noktası Ekle</button><button className="aft-btn primary" onClick={checkAll} disabled={busy}><RefreshCw size={18} className={busy ? "spin" : ""}/>{busy ? "Kontrol Ediliyor" : "Şimdi Kontrol Et"}</button></div>
    </div>

    <div className="aft-stats">
      <div className="aft-stat"><span className="aft-stat-icon"><MapPin/></span><div><b>{rows.length}</b><small>Takip edilen nokta</small></div></div>
      <div className="aft-stat"><span className="aft-stat-icon"><BellRing/></span><div><b>{changed}</b><small>Son kontrolde değişen</small></div></div>
      <div className="aft-stat"><span className="aft-stat-icon"><Building2/></span><div><b>{new Set(rows.map(r=>r.provider)).size}</b><small>Akaryakıt firması</small></div></div>
      <div className="aft-stat"><span className="aft-stat-icon"><Clock3/></span><div><b className="small-value">{lastCheck ? new Date(lastCheck).toLocaleString("tr-TR", {hour:"2-digit",minute:"2-digit"}) : "Henüz yok"}</b><small>Son kontrol</small></div></div>
    </div>

    {message && <div className="aft-message"><CheckCircle2 size={18}/>{message}</div>}

    <section className="aft-panel">
      <div className="aft-panel-head"><div><h2>Takip Listesi</h2><p>Değişen fiyatlar otomatik olarak geçmişe eklenir.</p></div><span className="aft-live"><i/> CANLI TAKİP</span></div>
      {!rows.length ? <div className="aft-empty"><Fuel size={42}/><h3>Henüz takip noktası yok</h3><p>Petrol Ofisi veya Shell için il / ilçe ekleyerek başlayın.</p><button className="aft-btn primary" onClick={()=>setModal(true)}><Plus size={18}/> İlk Noktayı Ekle</button></div> :
      <div className="aft-table-wrap"><table className="aft-table"><thead><tr><th>FİRMA</th><th>LOKASYON</th><th>YAKIT</th><th>GÜNCEL FİYAT</th><th>ÖNCEKİ</th><th>DEĞİŞİM</th><th>SON KONTROL</th><th></th></tr></thead><tbody>{rows.map(row => {
        const change = row.previousPrice != null ? pct(Number(row.previousPrice), Number(row.price)) : 0;
        return <tr key={row.id} className={row.status === "Değişti" ? "changed" : ""}><td><span className={`aft-brand ${row.provider === "Shell" ? "shell" : "po"}`}>{row.provider === "Shell" ? "S" : "PO"}</span><strong>{row.provider}</strong></td><td><b>{row.city}</b><small>{row.district}</small></td><td><span className="aft-fuel">{row.fuel}</span></td><td className="price">{money(row.price)}</td><td>{money(row.previousPrice)}</td><td>{row.previousPrice == null ? <span className="muted">—</span> : change > 0 ? <span className="up"><TrendingUp size={15}/> +%{Math.abs(change).toFixed(2)}</span> : change < 0 ? <span className="down"><TrendingDown size={15}/> -%{Math.abs(change).toFixed(2)}</span> : <span className="same">Değişmedi</span>}</td><td><small>{row.checkedAt ? new Date(row.checkedAt).toLocaleString("tr-TR") : "Kontrol bekliyor"}</small></td><td><div className="aft-row-actions"><button title="Fiyat gir / güncelle" onClick={()=>manualUpdate(row)}><Fuel size={16}/></button><button title="Sil" onClick={()=>setRows(v=>v.filter(x=>x.id!==row.id))}><Trash2 size={16}/></button></div></td></tr>
      })}</tbody></table></div>}
    </section>

    <section className="aft-panel history"><div className="aft-panel-head"><div><h2><History size={20}/> Fiyat Değişim Geçmişi</h2><p>Eski ve yeni fiyat, fark ve değişim oranı birlikte tutulur.</p></div></div>
      {!history.length ? <div className="aft-history-empty">Henüz fiyat değişikliği kaydı oluşmadı.</div> : <div className="aft-table-wrap"><table className="aft-table"><thead><tr><th>TARİH</th><th>FİRMA</th><th>LOKASYON</th><th>YAKIT</th><th>ESKİ</th><th>YENİ</th><th>FARK</th></tr></thead><tbody>{history.slice(0,100).map(h => { const d=pct(h.oldPrice,h.newPrice); return <tr key={h.id}><td>{new Date(h.changedAt).toLocaleString("tr-TR")}</td><td>{h.provider}</td><td>{h.city} / {h.district}</td><td>{h.fuel}</td><td>{money(h.oldPrice)}</td><td><b>{money(h.newPrice)}</b></td><td>{d>=0?<span className="up">+%{d.toFixed(2)}</span>:<span className="down">-%{Math.abs(d).toFixed(2)}</span>}</td></tr>})}</tbody></table></div>}
    </section>

    <div className="aft-source-note"><div><b>Kaynak durumu</b><span>“Şimdi Kontrol Et” Petrol Ofisi kayıtlarını il/ilçe fiyatından, Shell kayıtlarını ise Shell’in resmi il tavan tavsiye fiyat sayfasından kontrol eder. Shell kaynağı il bazında olduğundan seçtiğiniz ilçe takip etiketi olarak korunur.</span></div><a href="https://www.petrolofisi.com.tr/akaryakit-fiyatlari" target="_blank" rel="noreferrer">Petrol Ofisi <ExternalLink size={14}/></a><a href="https://www.shell.com.tr/suruculer/shell-yakitlari/akaryakit-pompa-satis-fiyatlari.html" target="_blank" rel="noreferrer">Shell <ExternalLink size={14}/></a></div>

    {modal && <div className="aft-modal-backdrop" onMouseDown={()=>setModal(false)}><div className="aft-modal" onMouseDown={e=>e.stopPropagation()}><div className="aft-modal-head"><div><h2>Takip Noktası Ekle</h2><p>Kontrol etmek istediğiniz firma ve bölgeyi tanımlayın.</p></div><button onClick={()=>setModal(false)}><X/></button></div><div className="aft-form">
      <label>Firma<select value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})}>{PROVIDERS.map(x=><option key={x}>{x}</option>)}</select></label>
      <div className="aft-grid"><label>İl<input placeholder="Örn. KOCAELİ" value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label><label>İlçe<input placeholder="Örn. İZMİT" value={form.district} onChange={e=>setForm({...form,district:e.target.value})}/></label></div>
      <label>Yakıt türü<select value={form.fuel} onChange={e=>setForm({...form,fuel:e.target.value})}>{FUELS.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Başlangıç fiyatı <span>(opsiyonel)</span><input inputMode="decimal" placeholder="Örn. 53,85" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label>
    </div><div className="aft-modal-foot"><button className="aft-btn ghost" onClick={()=>setModal(false)}>Vazgeç</button><button className="aft-btn primary" onClick={addRow}><Plus size={18}/> Takibe Ekle</button></div></div></div>}
  </div>;
}
