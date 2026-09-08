import React, { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
    FileSpreadsheet,
    UploadCloud,
    Download,
    FileText,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Table as TableIcon,
    Sparkles,
    Building2,
    Route,
    PackageCheck,
    ArrowRight,
    ScanSearch,
    WandSparkles,
    LoaderCircle,
    RotateCcw,
    BadgeCheck,
    Gauge,
} from "lucide-react";
import "./Fasdat.css";

const TR_LOCALE = "tr-TR";

function normalizeHeader(h) {
    if (!h && h !== 0) return "";
    const s = String(h).trim().replace(/\s+/g, " ");
    return s.replace(/[İI]/g, "I").replace(/[ıi]/g, "i").toLowerCase();
}

function getField(row, key) {
    const normKey = normalizeHeader(key);
    if (!row.__norm__) {
        const n = {};
        for (const k of Object.keys(row)) n[normalizeHeader(k)] = row[k];
        row.__norm__ = n;
    }
    return row.__norm__[normKey] ?? "";
}

function parseExcelDate(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") {
        const utcDays = Math.floor(value - 25569);
        const dateInfo = new Date(utcDays * 86400 * 1000);
        const fractionalDay = value - Math.floor(value);
        if (fractionalDay) {
            const totalSeconds = Math.round(86400 * fractionalDay);
            dateInfo.setSeconds(dateInfo.getSeconds() + totalSeconds);
        }
        return dateInfo;
    }
    const s = String(value).trim();
    const m = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})$/);
    if (m) {
        const d = +m[1];
        const mo = +m[2] - 1;
        let y = +m[3];
        if (y < 100) y += 2000;
        return new Date(y, mo, d);
    }
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
}

function formatDateTR(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat(TR_LOCALE, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

const TARGET_COLUMNS = [
    "Vkn",
    "Proje",
    "Sipariş Tarihi",
    "Yükleme Tarihi",
    "Teslim Tarihi",
    "Müşteri Sipariş No",
    "Müşteri Referans No",
    "İstenilen Araç Tipi",
    "Açıklama",
    "Yükleme Firması Adı",
    "Alıcı Firma Cari Adı",
    "Teslim Firma Adres Adı",
    "İrsaliye No",
    "İrsaliye Miktarı",
    "Ürün",
    "Kap Adet",
    "Ambalaj Tipi",
    "Brüt KG",
    "M3",
    "Desi",
];

const AUTO = {
    VKN: "3850012676",
    PROJE: "747",
    URUN: "176",
    KAP_ADET: "1",
    AMBALAJ_TIPI: "1",
    BRUT_KG: "25000",
};

const ORDER_MODES = {
    NORMAL: "NORMAL",
    AFYON_YUKLEMELI: "AFYON_YUKLEMELI",
};

const AFYON_RULES = {
    YUKLEME_FIRMASI_ID: "34732",
    ALICI_FIRMA_ID: "21828",
};

const normVal = (v) =>
    String(v ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleUpperCase("tr-TR");

function mapYuklemeFirmasiToId(val) {
    const s = normVal(val);
    const mapping = {
        "ATAKEY SARNIÇ KÖYÜ": "35989",
        "ATAKEY TOMARZA": "35990",
        "KARAPINAR PATATES TARLA": "36114",
        "ATAKEY EĞRİBAYAT": "27682",
        "FASDAT KARATAY YARMA TARLA": "35837",
        "TOPRAKLIK MEVKİ KONYA": "36341",
        "KARADAYI KÖYÜ BÜNYAN": "36420",
        "HHG PATATES TARLA": "35587",
        "EMİRGAZİ TARLA": "36308",
        "BEYLİKOVA KÖYÜ PATATES": "36477",
        "ATAKEY DEVELİ PATATES": "36746",
        "FASDAT BALA PATATES": "36597",
        "ATAKEY HACINUMAN KÖYÜ": "36747",
        "MERAM BORUKTOLU SOĞAN": "36497",
        "YÜKSECİK MEVKİ PATATES TARLA": "36799",
        "POLATLI YÜZÜKBAŞI KÖYÜ PATATES": "36853",
        "MEZGİTLİ PATATES TARLA": "36537",
        "PATNOS ÜRKÜT KÖYÜ": "36855",
        "AHLAT TAŞHARMAN KÖYÜ": "36856",
        "ADİLCEVAZ GÖZDÜZÜ KÖYÜ": "36857",
        "PATATES TARLA ERBAA": "34735",
        "PATATES TARLA NİKSAR": "34736",
        "SOĞAN TARLA": "34733",
        "PATATES TARLA": "34734",
        "ATAKEY AFYON": AFYON_RULES.YUKLEME_FIRMASI_ID,
    };

    for (const key in mapping) {
        if (s.includes(key)) return mapping[key];
    }
    return val ?? "";
}

function buildMappedRow(r, rowIndex, orderMode) {
    const sipRaw = getField(r, "Sipariş Tarihi");
    const dSip = parseExcelDate(sipRaw);
    const dYuk = dSip ? new Date(dSip) : null;
    const dTes = dSip ? new Date(dSip.getTime() + 86400000) : null;

    let yf = mapYuklemeFirmasiToId(getField(r, "Yükleme Firması Adı"));
    let ta = getField(r, "Teslim Firma Adres Adı");
    let ac = getField(r, "Alıcı Firma Cari Adı");

    if (orderMode === ORDER_MODES.AFYON_YUKLEMELI) {
        yf = AFYON_RULES.YUKLEME_FIRMASI_ID;
        ac = AFYON_RULES.ALICI_FIRMA_ID;
        ta = mapYuklemeFirmasiToId(getField(r, "Teslim Firma Adres Adı"));
    } else {
        if (normVal(ta).includes("ATAKEY AFYON")) {
            ta = "34732";
            ac = "21828";
        }
    }

    return {
        Vkn: AUTO.VKN,
        Proje: AUTO.PROJE,
        "Sipariş Tarihi": formatDateTR(dSip),
        "Yükleme Tarihi": formatDateTR(dYuk),
        "Teslim Tarihi": formatDateTR(dTes),
        "Müşteri Sipariş No": getField(r, "Müşteri Sipariş No"),
        "Müşteri Referans No": "",
        "İstenilen Araç Tipi": getField(r, "İstenilen Araç Tipi"),
        Açıklama: getField(r, "Açıklama"),
        "Yükleme Firması Adı": yf,
        "Alıcı Firma Cari Adı": ac,
        "Teslim Firma Adres Adı": ta,
        "İrsaliye No": "",
        "İrsaliye Miktarı": "",
        Ürün: AUTO.URUN,
        "Kap Adet": AUTO.KAP_ADET,
        "Ambalaj Tipi": AUTO.AMBALAJ_TIPI,
        "Brüt KG": AUTO.BRUT_KG,
        M3: "",
        Desi: "",
    };
}

function ModeCard({ active, title, desc, icon: Icon, onClick, tone = "blue" }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`fasdat-mode-card ${active ? "is-active" : ""} tone-${tone}`}
        >
            <span className="fasdat-mode-icon">
                <Icon size={22} strokeWidth={1.9} />
            </span>

            <span className="fasdat-mode-copy">
                <span className="fasdat-mode-title-row">
                    <strong>{title}</strong>
                    {active && <span className="fasdat-mode-badge">Aktif</span>}
                </span>
                <span className="fasdat-mode-description">{desc}</span>
            </span>
        </button>
    );
}

export default function Fasdat() {
    const [rows, setRows] = useState([]);
    const [error, setError] = useState("");
    const [fileName, setFileName] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [orderMode, setOrderMode] = useState(ORDER_MODES.NORMAL);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processProgress, setProcessProgress] = useState(0);
    const [processLabel, setProcessLabel] = useState("");

    const activeModeMeta = useMemo(() => {
        return orderMode === ORDER_MODES.AFYON_YUKLEMELI
            ? {
                title: "ATAKEY AFYON Yüklemeli Sipariş",
                badge: "AFYON MODU",
                description:
                    "Tüm satırlarda yükleme firması 34732, alıcı firma 21828 olarak yazılır. Teslim firma adresi ise listedeki metne göre otomatik ID'ye çevrilir.",
            }
            : {
                title: "Normal Sipariş",
                badge: "STANDART MOD",
                description:
                    "Mevcut kurallar aynen çalışır. Yükleme firması eşleştirmeleri ve mevcut ATAKEY AFYON kontrolü korunur.",
            };
    }, [orderMode]);

    const onFiles = useCallback(
        async (file) => {
            if (!file) return;

            setError("");
            setFileName(file.name);
            setRows([]);
            setIsProcessing(true);
            setProcessProgress(12);
            setProcessLabel("Dosya okunuyor");

            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

            try {
                await wait(120);
                const buf = await file.arrayBuffer();
                setProcessProgress(34);
                setProcessLabel("Excel yapısı analiz ediliyor");
                await wait(120);
                const wb = XLSX.read(buf, { type: "array" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
                setProcessProgress(58);
                setProcessLabel("Kolonlar doğrulanıyor");
                await wait(120);

                if (!json.length) {
                    throw new Error("Excel sayfasında veri bulunamadı.");
                }

                setProcessProgress(78);
                setProcessLabel("ID eşleştirmeleri uygulanıyor");
                const mapped = json.map((r, idx) =>
                    buildMappedRow(r, idx, orderMode)
                );
                await wait(140);
                setRows(mapped);
                setProcessProgress(100);
                setProcessLabel("Çıktı hazır");
                await wait(260);
            } catch (e) {
                setRows([]);
                setError(e?.message || "Dosya okuma hatası.");
            } finally {
                setIsProcessing(false);
            }
        },
        [orderMode]
    );

    const downloadExcel = () => {
        if (!rows.length) return;

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows, { header: TARGET_COLUMNS });
        XLSX.utils.book_append_sheet(wb, ws, "Fasdat_Formatted");
        XLSX.writeFile(
            wb,
            `Fasdat_Export_${orderMode}_${new Date().toISOString().slice(0, 10)}.xlsx`
        );
    };

    const reset = () => {
        setRows([]);
        setFileName("");
        setError("");
        setIsDragging(false);
        setIsProcessing(false);
        setProcessProgress(0);
        setProcessLabel("");
    };

    const changeMode = (mode) => {
        setOrderMode(mode);
        reset();
    };

    return (
        <div className="fasdat-page ots-page">
            <section className="fasdat-hero">
                <div className="fasdat-hero-main">
                    <span className="fasdat-hero-icon">
                        <FileSpreadsheet size={25} strokeWidth={1.9} />
                    </span>

                    <div>
                        <span className="fasdat-eyebrow">Sipariş İşlemleri</span>
                        <h2>Fasdat Veri Dönüştürücü</h2>
                        <p>
                            Excel verilerini lojistik sipariş formatına dönüştürün,
                            otomatik ID eşleştirmelerini uygulayın ve çıktıyı indirin.
                        </p>
                    </div>
                </div>

                <div className="fasdat-hero-actions">
                    {rows.length > 0 && (
                        <button
                            type="button"
                            onClick={reset}
                            className="fasdat-btn fasdat-btn-secondary fasdat-btn-icon"
                            title="Veriyi temizle"
                            aria-label="Veriyi temizle"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={downloadExcel}
                        disabled={!rows.length || isProcessing}
                        className="fasdat-btn fasdat-btn-primary fasdat-download-btn"
                    >
                        <span className="fasdat-btn-iconbox"><Download size={17} /></span>
                        <span>{rows.length ? "Hazır Excel'i İndir" : "Excel İndir"}</span>
                    </button>
                </div>
            </section>

            <section className="fasdat-flow" aria-label="Fasdat dönüşüm akışı">
                <div className={`fasdat-flow-step ${fileName ? "is-done" : "is-active"}`}>
                    <span><UploadCloud size={18} /></span><div><strong>Excel Yükle</strong><small>Kaynak dosyanı sisteme bırak</small></div>
                </div>
                <ArrowRight size={18} className="fasdat-flow-arrow" />
                <div className={`fasdat-flow-step ${rows.length ? "is-done" : fileName ? "is-active" : ""}`}>
                    <span><ScanSearch size={18} /></span><div><strong>Kontrol & Eşleştir</strong><small>ID ve kolonları otomatik doğrula</small></div>
                </div>
                <ArrowRight size={18} className="fasdat-flow-arrow" />
                <div className={`fasdat-flow-step ${rows.length ? "is-active" : ""}`}>
                    <span><WandSparkles size={18} /></span><div><strong>Dönüştür & İndir</strong><small>Hazır lojistik formatını dışa aktar</small></div>
                </div>
            </section>

            <section className="fasdat-mode-grid">
                <ModeCard
                    active={orderMode === ORDER_MODES.NORMAL}
                    title="Normal Sipariş Oluştur"
                    desc="Mevcut mapping mantığı ve ATAKEY AFYON kontrolü aynen çalışır."
                    icon={PackageCheck}
                    tone="slate"
                    onClick={() => changeMode(ORDER_MODES.NORMAL)}
                />

                <ModeCard
                    active={orderMode === ORDER_MODES.AFYON_YUKLEMELI}
                    title="ATAKEY AFYON Yüklemeli Sipariş"
                    desc="Yükleme firması 34732, alıcı firma 21828 olur; teslim adresi mapping tablosundan ID'ye çevrilir."
                    icon={Building2}
                    tone="blue"
                    onClick={() => changeMode(ORDER_MODES.AFYON_YUKLEMELI)}
                />
            </section>

            <section className="fasdat-operation-strip">
                <div className="fasdat-operation-state">
                    <span className={`fasdat-operation-icon ${rows.length ? "is-ready" : ""}`}>
                        {isProcessing ? <LoaderCircle size={20} className="fasdat-spin" /> : rows.length ? <BadgeCheck size={20} /> : <Gauge size={20} />}
                    </span>
                    <div>
                        <small>İŞLEM DURUMU</small>
                        <strong>{isProcessing ? processLabel : rows.length ? "Dönüştürme tamamlandı" : "Dosya bekleniyor"}</strong>
                    </div>
                </div>
                <div className="fasdat-mini-stat"><small>Aktif Mod</small><strong>{orderMode === ORDER_MODES.NORMAL ? "Normal Sipariş" : "ATAKEY Afyon"}</strong></div>
                <div className="fasdat-mini-stat"><small>Kayıt</small><strong>{rows.length}</strong></div>
                <div className="fasdat-mini-stat"><small>Çıktı</small><strong>{rows.length ? "Hazır" : "Bekliyor"}</strong></div>
            </section>

            <section className="fasdat-workspace">
                <div className="fasdat-main-column">
                    {!rows.length ? (
                        <label
                            className={`fasdat-dropzone ${isDragging ? "is-dragging" : ""} ${isProcessing ? "is-processing" : ""}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                onFiles(e.dataTransfer.files?.[0]);
                            }}
                        >
                            <input
                                type="file"
                                accept=".xlsx,.xls,.xlsm,.csv"
                                onChange={(e) => {
                                    onFiles(e.target.files?.[0]);
                                    e.target.value = "";
                                }}
                            />

                            <span className="fasdat-dropzone-icon">
                                {isProcessing ? <LoaderCircle size={34} strokeWidth={1.7} className="fasdat-spin" /> : <UploadCloud size={34} strokeWidth={1.7} />}
                            </span>

                            <strong>{isProcessing ? processLabel : "Excel dosyasını buraya bırakın"}</strong>
                            <span>{isProcessing ? `${fileName} işleniyor` : "veya tıklayarak bilgisayarınızdan seçin"}</span>

                            {isProcessing ? (
                                <div className="fasdat-processing">
                                    <div className="fasdat-processing-meta"><span>Fasdat dönüşümü</span><b>%{processProgress}</b></div>
                                    <div className="fasdat-processing-track"><i style={{ width: `${processProgress}%` }} /></div>
                                    <div className="fasdat-processing-dots"><i /><i /><i /></div>
                                </div>
                            ) : (
                                <div className="fasdat-file-types">
                                    <span>.XLSX</span>
                                    <span>.XLS</span>
                                    <span>.CSV</span>
                                </div>
                            )}
                        </label>
                    ) : (
                        <div className="fasdat-alert fasdat-alert-success fasdat-ready-card">
                            <span className="fasdat-ready-icon"><CheckCircle2 size={22} /></span>
                            <div>
                                <strong>Dosya hazır</strong>
                                <span>{fileName} — {rows.length} satır dönüştürüldü.</span>
                            </div>
                            <button type="button" className="fasdat-change-file" onClick={reset}>
                                <RotateCcw size={15} /> Yeni Dosya
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="fasdat-alert fasdat-alert-error">
                            <AlertCircle size={20} />
                            <div>
                                <strong>Dosya işlenemedi</strong>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    <div className="fasdat-preview-card">
                        <div className="fasdat-preview-header">
                            <div className="fasdat-preview-title">
                                <span className="fasdat-preview-icon">
                                    <TableIcon size={17} />
                                </span>
                                <div>
                                    <strong>Önizleme Paneli</strong>
                                    <span>Dönüştürülen sipariş verileri</span>
                                </div>
                            </div>

                            <div className="fasdat-preview-status">
                                {rows.length > 0 && <span className="fasdat-ready-pill"><i /> Hazır</span>}
                                <span className="fasdat-record-count">{rows.length} kayıt</span>
                            </div>
                        </div>

                        <div className="fasdat-table-scroll">
                            <table className="fasdat-table">
                                <thead>
                                    <tr>
                                        {TARGET_COLUMNS.map((col) => (
                                            <th key={col}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody>
                                    {rows.map((row, idx) => (
                                        <tr key={idx}>
                                            {TARGET_COLUMNS.map((col) => (
                                                <td key={col}>{row[col] || "-"}</td>
                                            ))}
                                        </tr>
                                    ))}

                                    {!rows.length && (
                                        <tr>
                                            <td
                                                className="fasdat-empty-cell"
                                                colSpan={TARGET_COLUMNS.length}
                                            >
                                                <div className="fasdat-empty-state">
                                                    <span>
                                                        <FileText size={34} />
                                                    </span>
                                                    <strong>Henüz veri yüklenmedi</strong>
                                                    <p>
                                                        Excel dosyanızı yüklediğinizde dönüştürülen
                                                        satırlar burada görüntülenecek.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <aside className="fasdat-side-column">
                    <div className="fasdat-info-card">
                        <div className="fasdat-info-heading">
                            <span className="fasdat-info-icon blue">
                                <Sparkles size={19} />
                            </span>
                            <div>
                                <span>Aktif İşlem Modu</span>
                                <strong>{activeModeMeta.title}</strong>
                            </div>
                        </div>

                        <span className="fasdat-status-badge">
                            {activeModeMeta.badge}
                        </span>

                        <p>{activeModeMeta.description}</p>
                    </div>

                    <div className="fasdat-info-card">
                        <div className="fasdat-info-heading">
                            <span className="fasdat-info-icon orange">
                                <Route size={19} />
                            </span>
                            <div>
                                <span>AFYON Modu Ayarları</span>
                                <strong>ID Özeti</strong>
                            </div>
                        </div>

                        <div className="fasdat-rule-list">
                            <div className="fasdat-rule-item">
                                <span>Yükleme Firması ID</span>
                                <strong>{AFYON_RULES.YUKLEME_FIRMASI_ID}</strong>
                            </div>

                            <div className="fasdat-rule-item">
                                <span>Alıcı Firma ID</span>
                                <strong>{AFYON_RULES.ALICI_FIRMA_ID}</strong>
                            </div>

                            <div className="fasdat-rule-item">
                                <span>Teslim Firma Adresi</span>
                                <strong>Mapping tablosundan otomatik bulunur</strong>
                            </div>
                        </div>

                        <div className="fasdat-note">
                            AFYON modunda teslim firma adresi Excel'deki metin
                            üzerinden mapping tablosunda aranır. Eşleşme bulunamazsa
                            mevcut değer korunur.
                        </div>
                    </div>
                </aside>
            </section>

            <footer className="fasdat-footer-note">
                <span>Sistem otomatik tarih hesaplar</span>
                <strong>Sipariş → Yükleme</strong>
                <i />
                <strong>Teslim = Sipariş + 1 Gün</strong>
            </footer>
        </div>
    );
}
