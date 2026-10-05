import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, History, RefreshCw, RotateCcw, Save, Settings2, ShieldCheck, TrendingUp, Users } from "lucide-react";
import * as XLSX from "xlsx";
import {
  applyEscalation,
  applyEscalationBatch,
  buildEscalationPreview,
  CUSTOMER_RULES,
  getContractRules,
  getEscalationAudit,
  getEscalationQueue,
  getEscalationSnapshots,
  ignoreEscalation,
  rollbackEscalation,
  saveContractRule
} from "./fuelEscalationEngine";
import "./YakitKontrolMerkezi.css";

const money = (value) => Number(value || 0).toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
const pct = (value) => `%${Math.abs(Number(value || 0)).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
const statusLabel = { pending: "Onay bekliyor", processing: "İşleniyor", suspicious: "Şüpheli veri", notified: "Sadece bildirildi", completed: "Tamamlandı", rolled_back: "Geri alındı", ignored: "Yok sayıldı", rejected: "Reddedildi", postponed: "Ertelendi" };

export default function YakitKontrolMerkezi() {
  const [, setVersion] = useState(0);
  const [tab, setTab] = useState("dashboard");
  const [selected, setSelected] = useState([]);
  const [active, setActive] = useState(null);
  const [message, setMessage] = useState("");
  const [rules, setRules] = useState(() => getContractRules());
  const queue = getEscalationQueue();
  const audit = getEscalationAudit();
  const snapshots = getEscalationSnapshots();
  const prices = (() => { try { return JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1") || "{}"); } catch { return {}; } })();
  const pending = queue.filter((item) => ["pending", "processing", "suspicious"].includes(item.status));
  const completed = queue.filter((item) => item.status === "completed");
  const totalImpact = queue.reduce((sum, item) => sum + Number(item.salesImpact || 0) + Number(item.buyImpact || 0), 0);

  const refresh = () => { setRules(getContractRules()); setVersion((value) => value + 1); };
  useEffect(() => { window.addEventListener("odak-escalation-changed", refresh); window.addEventListener("storage", refresh); return () => { window.removeEventListener("odak-escalation-changed", refresh); window.removeEventListener("storage", refresh); }; }, []);

  const saveRule = (customer, changes) => { saveContractRule(customer, changes); refresh(); setMessage(`${customer} sözleşme kuralı kaydedildi.`); };
  const applyOne = (id) => { const result = applyEscalation(id); setMessage(result.ok ? "Alış ve satış tarifeleri güncellendi." : result.reason); refresh(); };
  const applyBatch = () => { const results = applyEscalationBatch(selected); const success = results.filter((item) => item.ok).length; setMessage(`${success}/${selected.length} müşteri güncellendi.`); setSelected([]); refresh(); };
  const undo = (id) => { const result = rollbackEscalation(id); setMessage(result.ok ? "Son tarife değişikliği güvenli şekilde geri alındı." : result.reason); refresh(); };

  const exportAudit = () => {
    const summary = queue.map((item) => ({ "İşlem No": item.id, Müşteri: item.customer, Durum: statusLabel[item.status] || item.status, "Eski Yakıt": item.oldFuel, "Yeni Yakıt": item.newFuel, "Yakıt Değişimi": item.fuelChange / 100, "Uygulanan Oran": item.appliedRate / 100, "Etkilenen Güzergâh": item.affectedRoutes, "Alış Etkisi": item.buyImpact, "Satış Etkisi": item.salesImpact, Tarih: item.created_at }));
    const changes = queue.flatMap((item) => (item.comparison || []).map((row) => ({ "İşlem No": item.id, Müşteri: item.customer, Tarife: row.path, Tür: row.side === "buy" ? "Alış" : "Satış", "Eski Değer": row.before, "Yeni Değer": row.after, Fark: row.difference })));
    const logs = audit.map((item) => ({ "Kayıt No": item.id, Olay: item.event, Müşteri: item.customer || "", Kullanıcı: item.actor, Tarih: item.created_at, Cihaz: item.device?.platform || "", Tarayıcı: item.device?.userAgent || "" }));
    const wb = XLSX.utils.book_new();
    [["Özet", summary], ["Değişiklikler", changes], ["Denetim", logs]].forEach(([name, data]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.length ? data : [{ Bilgi: "Kayıt yok" }]), name));
    XLSX.writeFile(wb, `Yakit_Eskalasyon_Raporu_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const previewCurrent = (customer) => { const fuel = prices[customer] || {}; const preview = buildEscalationPreview({ customer, oldFuel: fuel.old || fuel.referencePrice, newFuel: fuel.new, secondaryPrice: rules[customer]?.secondaryPrice }); setActive(preview.ok ? preview : null); setMessage(preview.ok ? "Karşılaştırma hazırlandı." : preview.reason); setTab("compare"); };

  return <main className="fcm-page">
    <header className="fcm-hero"><div><span>YAKIT ESKALASYON MOTORU</span><h1>Tarife Kontrol Merkezi</h1><p>Alış ve satış tarifelerini, eskalasyonları ve sözleşme kurallarını tek ekrandan yönetin.</p></div><div className="fcm-hero-actions"><button onClick={exportAudit}><Download size={17}/> Excel raporu</button><button className="primary" onClick={refresh}><RefreshCw size={17}/> Yenile</button></div></header>
    {message && <div className="fcm-message" onClick={() => setMessage("")}>{message}<b>×</b></div>}
    <section className="fcm-kpis">
      <article><span><AlertTriangle/></span><div><small>BEKLEYEN ONAY</small><strong>{pending.length}</strong></div></article>
      <article><span><CheckCircle2/></span><div><small>GÜNCELLENEN TARİFE</small><strong>{completed.length}</strong></div></article>
      <article><span><Users/></span><div><small>AKTİF MÜŞTERİ</small><strong>{Object.keys(CUSTOMER_RULES).length}</strong></div></article>
      <article><span><TrendingUp/></span><div><small>TOPLAM TARİFE ETKİSİ</small><strong>{money(totalImpact)}</strong></div></article>
    </section>
    <nav className="fcm-tabs">{[["dashboard","Kontrol paneli"],["queue","Toplu işlemler"],["compare","Karşılaştırma"],["rules","Sözleşme kuralları"],["audit","Denetim kaydı"]].map(([key,label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>

    {tab === "dashboard" && <section className="fcm-grid">{Object.keys(CUSTOMER_RULES).map((customer) => { const fuel = prices[customer] || {}, rule = rules[customer], change = Number(fuel.change || 0) * 100; return <article className="fcm-customer" key={customer}><div className="fcm-card-head"><div><b>{customer}</b><small>{rule.provider} · {rule.location}</small></div><span className={`mode ${rule.mode}`}>{rule.mode === "auto" ? "Otomatik" : rule.mode === "notify" ? "Sadece bildir" : "Onaylı"}</span></div><div className="fcm-price"><strong>{fuel.new ? money(fuel.new) : "Veri bekleniyor"}</strong><em className={change < 0 ? "down" : ""}>{change ? `${change > 0 ? "+" : ""}${pct(change)}` : "—"}</em></div><div className="fcm-rule"><span>Eşik {pct(rule.threshold)}</span><span>Yansıtma {pct(rule.factor)}</span></div><button onClick={() => previewCurrent(customer)}>Etkiyi ve tarifeleri incele</button></article>; })}</section>}

    {tab === "queue" && <section className="fcm-panel"><div className="fcm-panel-head"><div><h2>Toplu işlem merkezi</h2><p>Güvenlik kontrolünden geçen müşterileri birlikte güncelleyin.</p></div><button className="primary" disabled={!selected.length} onClick={applyBatch}>Seçilenleri uygula ({selected.length})</button></div><div className="fcm-table-wrap"><table><thead><tr><th></th><th>Müşteri</th><th>Durum</th><th>Değişim</th><th>Yansıtma</th><th>Güzergâh</th><th>Satış etkisi</th><th>Kontrol</th><th></th></tr></thead><tbody>{queue.map((item) => <tr key={item.id} className={item.status === "suspicious" ? "risk" : ""}><td><input type="checkbox" checked={selected.includes(item.id)} disabled={Boolean(item.blockers?.length) || item.status === "completed"} onChange={(event) => setSelected((rows) => event.target.checked ? [...rows, item.id] : rows.filter((id) => id !== item.id))}/></td><td><b>{item.customer}</b><small>{item.id}</small></td><td><span className={`status ${item.status}`}>{statusLabel[item.status] || item.status}</span></td><td>{pct(item.fuelChange)}</td><td>{pct(item.appliedRate)}</td><td>{item.affectedRoutes}</td><td>{money(item.salesImpact)}</td><td>{item.blockers?.length ? item.blockers.join(", ") : "Kontroller geçti"}</td><td><div className="row-actions">{!["completed","ignored"].includes(item.status) && <button onClick={() => applyOne(item.id)}>Uygula</button>}<button onClick={() => { ignoreEscalation(item.id); refresh(); }}>Yok say</button></div></td></tr>)}</tbody></table></div></section>}

    {tab === "compare" && <section className="fcm-panel"><div className="fcm-panel-head"><div><h2>Değişiklik karşılaştırması</h2><p>Eski ve yeni alış–satış değerlerini yan yana inceleyin.</p></div>{active && <span className="fcm-active">{active.customer} · {pct(active.appliedRate)} uygulanacak</span>}</div>{active ? <><div className="fcm-impact"><div><small>Etkilenen güzergâh</small><b>{active.affectedRoutes}</b></div><div><small>Alış maliyeti etkisi</small><b>{money(active.buyImpact)}</b></div><div><small>Satış geliri etkisi</small><b>{money(active.salesImpact)}</b></div><div><small>Toplam fiyat alanı</small><b>{active.affectedRoutes}</b></div></div><div className="fcm-table-wrap"><table><thead><tr><th>Tarife yolu</th><th>Tür</th><th>Eski değer</th><th>Yeni değer</th><th>Fark</th></tr></thead><tbody>{active.comparison.slice(0, 150).map((row) => <tr key={`${row.path}-${row.side}`}><td>{row.path}</td><td>{row.side === "buy" ? "Alış" : "Satış"}</td><td>{money(row.before)}</td><td className="changed">{money(row.after)}</td><td>{money(row.difference)}</td></tr>)}</tbody></table></div></> : <div className="fcm-empty">Kontrol panelinden bir müşteri seçin.</div>}</section>}

    {tab === "rules" && <section className="fcm-rules">{Object.entries(rules).map(([customer, rule]) => <article key={customer}><div className="fcm-rule-title"><div><h3>{customer}</h3><span>{rule.provider} · {rule.location}</span></div><Settings2 size={19}/></div><label>Çalışma modu<select value={rule.mode} onChange={(event) => saveRule(customer, { mode: event.target.value })}><option value="auto">Otomatik uygula</option><option value="approval">Onay iste</option><option value="notify">Sadece bildir</option></select></label><div className="fcm-rule-fields"><label>Eşik (%)<input type="number" value={rule.threshold} onChange={(event) => saveRule(customer, { threshold: Number(event.target.value) })}/></label><label>Yansıtma (%)<input type="number" value={rule.factor} onChange={(event) => saveRule(customer, { factor: Number(event.target.value) })}/></label><label>Anormal sınır (%)<input type="number" value={rule.anomalyLimit} onChange={(event) => saveRule(customer, { anomalyLimit: Number(event.target.value) })}/></label><label>Kaynak toleransı (%)<input type="number" value={rule.sourceTolerance} onChange={(event) => saveRule(customer, { sourceTolerance: Number(event.target.value) })}/></label><label>İkinci kaynak fiyatı<input type="number" value={rule.secondaryPrice || ""} onChange={(event) => saveRule(customer, { secondaryPrice: Number(event.target.value) || null })}/></label><label>Yakıt türü<input value={rule.fuelType} onChange={(event) => saveRule(customer, { fuelType: event.target.value })}/></label><label>KDV yöntemi<select value={rule.vatMode} onChange={(event) => saveRule(customer, { vatMode: event.target.value })}><option>KDV dahil</option><option>KDV hariç (+KDV)</option></select></label></div><button onClick={() => saveRule(customer, rule)}><Save size={15}/> Kuralı kaydet</button></article>)}</section>}

    {tab === "audit" && <section className="fcm-panel"><div className="fcm-panel-head"><div><h2>Denetim ve geri alma</h2><p>Kullanıcı, tarih, cihaz ve değişiklik kayıtları.</p></div><button onClick={exportAudit}><Download size={16}/> Raporu indir</button></div><div className="fcm-snapshots">{snapshots.slice(0, 8).map((item) => <div key={item.id}><span><History size={16}/><b>{item.customer}</b><small>{new Date(item.created_at).toLocaleString("tr-TR")} · {item.actor}</small></span><button onClick={() => undo(item.id)}><RotateCcw size={14}/> Geri al</button></div>)}</div><div className="fcm-table-wrap"><table><thead><tr><th>Tarih</th><th>Olay</th><th>Müşteri</th><th>Kullanıcı</th><th>Cihaz</th><th>Kayıt</th></tr></thead><tbody>{audit.slice(0, 200).map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString("tr-TR")}</td><td>{item.event}</td><td>{item.customer || "—"}</td><td>{item.actor}</td><td>{item.device?.platform || "—"}</td><td>{item.id}</td></tr>)}</tbody></table></div></section>}
  </main>;
}
