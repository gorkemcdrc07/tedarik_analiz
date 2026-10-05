import React from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Download,
  History,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table2,
  Undo2,
  Users,
} from "lucide-react";

import "../YakitHesaplama.css";

export default function BimCustomerScreen({
  FuelOperationLoader,
  bimSearch,
  setBimSearch,
  bimTarifeler,
  getBimHistoryRows,
  bimHistory,
  undoLastBimUpdate,
  setBimHistoryOpen,
  exportBimExcel,
  goBackCustomers,
  bimThresholdPassed,
  runFuelOperation,
  applyBimUpdate,
  bimOldFuel,
  bimNewFuel,
  bimPct,
  bimFuelRate,
  bimCalcOpen,
  setBimCalcOpen,
  bimAppliedRate,
  BIM_DESTINATIONS,
  bimTariffDisplay,
  bimHistoryOpen,
  exportBimPriceMemoryExcel,
}) {
  const q = String(bimSearch || "").trim().toLocaleUpperCase("tr-TR");
  const shown = (bimTarifeler || []).filter(
    (row) => !q || `${row.sira} ${row.cikis}`.toLocaleUpperCase("tr-TR").includes(q)
  );
  const historyRows = getBimHistoryRows();
  const update = () => runFuelOperation("BİM tarifeleri güncelleniyor", applyBimUpdate);

  return (
    <div className="fuel-page fuel-full fuel-unified-customer fasdat-page bim-page bim-v56-page">
      <FuelOperationLoader />
      <section className="bim-v56-shell">
        <header className="bim-v56-header">
          <div className="bim-v56-brand"><img src="/fuel-assets/bim-logo-user.png" alt="BİM" /><div><span>BİM TARİFE YÖNETİMİ</span><h1>BİM – Yakıt Hesaplama</h1><p>Petrol Ofisi • İstanbul Sancaktepe • V/Max Diesel • KDV Hariç (+KDV)</p></div></div>
          <div className="bim-v56-actions">
            <button className="icon-btn" title="Son işlemi geri al" onClick={undoLastBimUpdate} disabled={!bimHistory.length}><Undo2 size={18} /><span>Geri Al</span></button>
            <button className="icon-btn" title="Fiyat geçmişi" onClick={() => setBimHistoryOpen(true)}><History size={18} /><span>Geçmiş</span></button>
            <button className="icon-btn excel" title="Excel'e aktar" onClick={exportBimExcel}><Download size={18} /><span>Excel</span></button>
            <button className="icon-btn" title="Diğer müşteriler" onClick={goBackCustomers}><Users size={18} /><span>Müşteriler</span></button>
            <button className="icon-btn update" title="Tarifeleri güncelle" disabled={!bimThresholdPassed} onClick={update}><RefreshCw size={18} /><span>Güncelle</span></button>
          </div>
        </header>
        <div className="bim-v56-summary">
          <div className="bim-v56-logo"><img src="/fuel-assets/bim-logo-user.png" alt="BİM" /><div><b>BİM</b><span>Özel Fiyatlandırma</span></div></div>
          <div className="bim-v56-metric old"><span>SON KABUL EDİLEN FİYAT</span><strong>{bimOldFuel || "—"} ₺</strong><small>Referans yakıt fiyatı</small></div>
          <div className="bim-v56-arrow"><ArrowRight size={22} /></div>
          <div className="bim-v56-metric current"><span>GÜNCEL YAKIT FİYATI</span><strong>{bimNewFuel || "—"} ₺</strong><small>Petrol Ofisi • Sancaktepe</small></div>
          <div className={`bim-v56-metric change ${bimThresholdPassed ? "passed" : ""}`}><span>DEĞİŞİM</span><strong>{bimPct(bimFuelRate)}</strong><small>{bimThresholdPassed ? "Eşik sağlandı" : "%5 eşik altında"}</small></div>
          <button className="bim-v56-rule-toggle" onClick={() => setBimCalcOpen((value) => !value)}><span><SlidersHorizontal size={18} /><i>BİM KURALI</i><b>%5 eşik <ArrowRight size={14} /> %40 yansıtma</b></span>{bimCalcOpen ? <ChevronUp size={19} /> : <ChevronDown size={19} />}</button>
        </div>
        {bimCalcOpen && <div className="bim-v56-rule-detail"><div><b>Hesaplama Kuralı</b><p>Yakıt fiyatı değişimi ±%5 veya üzerindeyse değişimin %40&apos;ı tarife fiyatlarına uygulanır. Sonuçlar mevcut standart yuvarlama kuralıyla tam TL&apos;ye çevrilir.</p></div><div className="bim-v56-rule-values"><span>Yakıt değişimi <b>{bimPct(bimFuelRate)}</b></span><span>Yansıtılan oran <b>{bimPct(bimAppliedRate)}</b></span><span>Durum <b>{bimThresholdPassed ? "Güncelleme hazır" : "Kural sağlanmadı"}</b></span></div></div>}
      </section>
      <section className="eti-tariff-workspace bim-workspace"><div className="eti-workspace-top"><div><span>BİM TARİFE MATRİSİ</span><h2><Table2 size={20} /> Tarife Tablosu</h2><p>39 çıkış bölgesi × 7 teslim bölgesi</p></div><div className="bim-v48-table-actions"><button className="bim-v51-excel-btn" onClick={exportBimExcel}><Download size={16} /> Excel&apos;e Aktar</button><button className="bim-v48-update-btn" disabled={!bimThresholdPassed} onClick={update}><RefreshCw size={16} /> Tarifeleri Güncelle</button></div><label className="eti-search eti-global-search"><Search size={15} /><input value={bimSearch} onChange={(event) => setBimSearch(event.target.value)} placeholder="Çıkış bölgesi ara..." />{bimSearch && <button type="button" onClick={() => setBimSearch("")}>×</button>}</label></div><div className="fuel-table-wrap bim-table-wrap"><table className="fuel-table bim-table"><thead><tr><th>SIRA</th><th>ATIK ÇIKIŞ BÖLGESİ</th>{BIM_DESTINATIONS.map((destination) => <th key={destination}>{destination}</th>)}</tr></thead><tbody>{shown.map((row) => <tr key={row.sira}><td>{row.sira}</td><td><b>{row.cikis}</b></td>{BIM_DESTINATIONS.map((destination) => <td key={destination} className="bim-price">{bimTariffDisplay(row.fiyatlar?.[destination] || 0)}</td>)}</tr>)}</tbody></table></div></section>
      {bimHistoryOpen && createPortal(<div className="fuel-modal-backdrop eti-history-backdrop"><div className="fuel-modal history-modal eti-history-modal bim-history-modal"><div className="fasdat-history-hero"><div className="fasdat-history-icon"><History size={21} /></div><div className="fasdat-history-copy"><span>BİM / TARİFE GEÇMİŞİ</span><h2>Yakıt Güncelleme Geçmişi</h2><p>Eski/yeni yakıt, değişim oranı ve tarifeye uygulanan oran.</p></div><div className="fasdat-history-actions"><button className="fuel-excel-button" onClick={exportBimPriceMemoryExcel}><Download size={15} /> Excel&apos;e Aktar</button><button className="fasdat-history-close" onClick={() => setBimHistoryOpen(false)}>×</button></div></div><div className="bim-history-content">{historyRows.length ? <div className="fuel-table-wrap bim-history-table-wrap"><table className="fuel-table bim-history-table"><thead><tr><th>TARİH</th><th>SIRA</th><th>ATIK ÇIKIŞ BÖLGESİ</th><th>VARIŞ</th><th>ESKİ FİYAT</th><th>YENİ FİYAT</th><th>FARK</th><th>YAKIT DEĞİŞİMİ</th><th>UYGULANAN</th></tr></thead><tbody>{historyRows.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString("tr-TR")}</td><td>{row.sira}</td><td><b>{row.cikis}</b></td><td>{row.varis}</td><td>{bimTariffDisplay(row.eski)}</td><td><b>{bimTariffDisplay(row.yeni)}</b></td><td>{bimTariffDisplay(row.fark)}</td><td>{bimPct(row.yakit_orani)}</td><td><b>{bimPct(row.uygulanan_oran)}</b></td></tr>)}</tbody></table></div> : <div className="eti-history-empty"><History size={28} /><h3>Henüz geçmiş kaydı yok</h3><p>BİM tarifeleri güncellendiğinde her çıkış-varış fiyat değişikliği burada satır satır görünür.</p></div>}</div></div></div>, document.body)}
    </div>
  );
}
