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
} from "lucide-react";

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

function ModeCard({ active, title, desc, icon, onClick, accentClass }) {
    const Icon = icon;
    return (
        <button
            onClick={onClick}
            className={`relative overflow-hidden rounded-[1.75rem] border text-left p-5 transition-all duration-300 w-full group
        ${active
                    ? "border-blue-500 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-2xl shadow-blue-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-slate-700 text-slate-800 dark:text-white"
                }`}
        >
            <div className="flex items-start gap-4">
                <div
                    className={`rounded-2xl p-3 transition-all ${active
                            ? "bg-white/15"
                            : `${accentClass} bg-slate-50 dark:bg-slate-800`
                        }`}
                >
                    <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-black tracking-tight text-base md:text-lg">
                            {title}
                        </h3>
                        {active && (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-white/15 uppercase tracking-[0.18em] font-black">
                                aktif
                            </span>
                        )}
                    </div>
                    <p
                        className={`mt-1.5 text-sm leading-6 ${active
                                ? "text-white/80"
                                : "text-slate-500 dark:text-slate-400"
                            }`}
                    >
                        {desc}
                    </p>
                </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-60" />
        </button>
    );
}

export default function Fasdat() {
    const [rows, setRows] = useState([]);
    const [error, setError] = useState("");
    const [fileName, setFileName] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [orderMode, setOrderMode] = useState(ORDER_MODES.NORMAL);

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
            try {
                const buf = await file.arrayBuffer();
                const wb = XLSX.read(buf, { type: "array" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

                if (!json.length) throw new Error("Excel sayfasında veri bulunamadı.");

                const mapped = json.map((r, idx) => buildMappedRow(r, idx, orderMode));
                setRows(mapped);
            } catch (e) {
                setError(e.message || "Dosya okuma hatası.");
            }
        },
        [orderMode]
    );

    const downloadExcel = () => {
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
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] p-3 sm:p-4 lg:p-6 xl:p-8 font-sans transition-colors duration-300 overflow-x-hidden">
            <div className="w-full max-w-[1400px] mx-auto space-y-4 lg:space-y-6">
                <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/60 dark:bg-slate-800/50 backdrop-blur-md p-4 sm:p-5 lg:p-6 rounded-[1.75rem] border border-white dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                        <div className="shrink-0 p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none">
                            <FileSpreadsheet className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-slate-800 dark:text-white truncate">
                                Fasdat Veri Dönüştürücü
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium leading-5">
                                Lojistik formatlama, otomatik ID eşleştirme ve sipariş modu seçimi
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
                        {rows.length > 0 && (
                            <button
                                onClick={reset}
                                className="p-2.5 text-slate-400 hover:text-rose-500 transition-colors bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-700 shrink-0"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={downloadExcel}
                            disabled={!rows.length}
                            className="flex items-center justify-center gap-2 px-4 sm:px-5 lg:px-6 py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-bold text-xs sm:text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:hover:scale-100 shadow-lg shadow-slate-200 dark:shadow-blue-900/20 whitespace-nowrap"
                        >
                            <Download className="w-4 h-4" /> Excel İndir
                        </button>
                    </div>
                </header>

                <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 lg:gap-4">
                    <ModeCard
                        active={orderMode === ORDER_MODES.NORMAL}
                        title="Normal Sipariş Oluştur"
                        desc="Mevcut mapping mantığı çalışır. Kodda şu an nasıl işliyorsa aynı şekilde devam eder."
                        icon={PackageCheck}
                        onClick={() => {
                            setOrderMode(ORDER_MODES.NORMAL);
                            setRows([]);
                            setFileName("");
                            setError("");
                        }}
                        accentClass="text-slate-700 dark:text-slate-200"
                    />

                    <ModeCard
                        active={orderMode === ORDER_MODES.AFYON_YUKLEMELI}
                        title="ATAKEY AFYON Yüklemeli Sipariş Oluştur"
                        desc="Seçildiğinde yükleme firması 34732, alıcı firma 21828 olur. Teslim firma adresi mapping içinden ID'ye çevrilir."
                        icon={Building2}
                        onClick={() => {
                            setOrderMode(ORDER_MODES.AFYON_YUKLEMELI);
                            setRows([]);
                            setFileName("");
                            setError("");
                        }}
                        accentClass="text-blue-600 dark:text-blue-400"
                    />
                </section>

                <section className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.2fr)_360px] gap-4 lg:gap-6 items-start">
                    <div className="min-w-0 space-y-4 lg:space-y-6">
                        {!rows.length ? (
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    onFiles(e.dataTransfer.files[0]);
                                }}
                                className={`relative group border-2 border-dashed rounded-[2rem] lg:rounded-[2.25rem] px-6 py-14 sm:px-8 sm:py-16 lg:px-10 lg:py-20 transition-all duration-500 overflow-hidden min-h-[260px] flex items-center justify-center
                  ${isDragging
                                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 scale-[0.995]"
                                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50"
                                    }
                  hover:border-blue-400 dark:hover:border-blue-500/50 shadow-2xl shadow-slate-200/40 dark:shadow-none`}
                            >
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => onFiles(e.target.files[0])}
                                />
                                <div className="flex flex-col items-center text-center space-y-4 max-w-md mx-auto">
                                    <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-full group-hover:scale-110 transition-transform duration-500">
                                        <UploadCloud
                                            className={`w-10 h-10 sm:w-12 sm:h-12 ${isDragging ? "text-blue-500" : "text-slate-400"
                                                }`}
                                        />
                                    </div>
                                    <div>
                                        <p className="text-lg sm:text-xl font-bold text-slate-700 dark:text-slate-200 leading-snug">
                                            Excel dosyasını buraya bırakın
                                        </p>
                                        <p className="text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest text-[10px] font-black">
                                            veya tıklayarak seçin
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2 text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full">
                                        <span className="text-blue-500">.XLSX</span>
                                        <span>.XLS</span>
                                        <span>.CSV</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                                        Başarıyla İşlendi
                                    </p>
                                    <p className="text-emerald-600/70 dark:text-emerald-500/60 text-xs font-medium truncate">
                                        {fileName} — {rows.length} satır hazır.
                                    </p>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                                <p className="text-rose-600 dark:text-rose-400 font-bold text-sm">
                                    {error}
                                </p>
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-900 rounded-[1.75rem] lg:rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden min-w-0">
                            <div className="px-4 sm:px-5 lg:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                                <div className="flex items-center gap-2 min-w-0">
                                    <TableIcon className="w-4 h-4 text-blue-500 shrink-0" />
                                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-tight sm:tracking-tighter text-slate-500 truncate">
                                        Önizleme Paneli
                                    </span>
                                </div>
                                <span className="px-3 py-1 bg-white dark:bg-slate-950 rounded-lg text-[10px] font-bold shadow-sm dark:text-slate-400 tracking-widest shrink-0">
                                    {rows.length} KAYIT
                                </span>
                            </div>

                            <div className="w-full overflow-x-auto overflow-y-auto max-h-[520px]">
                                <div className="min-w-[1400px]">
                                    <table className="w-full text-left border-collapse table-auto">
                                        <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
                                            <tr>
                                                {TARGET_COLUMNS.map((col) => (
                                                    <th
                                                        key={col}
                                                        className="px-4 lg:px-5 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide lg:tracking-widest border-b dark:border-slate-800"
                                                    >
                                                        <div className="whitespace-nowrap">{col}</div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                            {rows.map((row, idx) => (
                                                <tr
                                                    key={idx}
                                                    className="hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-colors group"
                                                >
                                                    {TARGET_COLUMNS.map((col) => (
                                                        <td
                                                            key={col}
                                                            className="px-4 lg:px-5 py-3.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap"
                                                        >
                                                            <span className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                                {row[col] || "-"}
                                                            </span>
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                            {rows.length === 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={TARGET_COLUMNS.length}
                                                        className="py-24 sm:py-32 text-center"
                                                    >
                                                        <div className="flex flex-col items-center opacity-20 px-4">
                                                            <FileText className="w-14 h-14 sm:w-16 sm:h-16 mb-4" />
                                                            <p className="font-bold tracking-tight sm:tracking-tighter text-sm sm:text-base">
                                                                Görüntülenecek veri bulunmuyor
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
                    </div>

                    <aside className="space-y-4 min-w-0 2xl:sticky 2xl:top-6">
                        <div className="rounded-[1.75rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 lg:p-6 shadow-xl">
                            <div className="flex items-center gap-3 mb-4 min-w-0">
                                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 shrink-0">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                                        Aktif İşlem Modu
                                    </p>
                                    <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-800 dark:text-white leading-snug break-words">
                                        {activeModeMeta.title}
                                    </h2>
                                </div>
                            </div>

                            <span className="inline-flex max-w-full px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-4">
                                {activeModeMeta.badge}
                            </span>

                            <p className="text-sm leading-7 text-slate-500 dark:text-slate-400">
                                {activeModeMeta.description}
                            </p>
                        </div>

                        <div className="rounded-[1.75rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 lg:p-6 shadow-xl space-y-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shrink-0">
                                    <Route className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                                        AFYON Modu Ayarları
                                    </p>
                                    <h3 className="font-black tracking-tight text-slate-800 dark:text-white break-words">
                                        ID Özeti
                                    </h3>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 min-w-0">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">
                                        Yükleme Firması ID
                                    </p>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 break-all">
                                        {AFYON_RULES.YUKLEME_FIRMASI_ID}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 min-w-0">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">
                                        Alıcı Firma ID
                                    </p>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 break-all leading-6">
                                        {AFYON_RULES.ALICI_FIRMA_ID}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 min-w-0">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">
                                        Teslim Firma Adresi
                                    </p>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 break-all leading-6">
                                        Mapping tablosundan otomatik bulunur
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-4">
                                <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                                    AFYON modunda teslim firma adresi, Excel'deki metin değeri
                                    mapping içinde aranarak ID'ye çevrilir. Eşleşme bulunamazsa
                                    mevcut değer olduğu gibi bırakılır.
                                </p>
                            </div>
                        </div>
                    </aside>
                </section>
            </div>

            <footer className="w-full max-w-[1400px] mx-auto mt-4 lg:mt-6 px-4 sm:px-6 py-4 bg-white/30 dark:bg-slate-800/20 backdrop-blur rounded-2xl border border-white/20 text-center">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] sm:tracking-[0.2em] leading-5">
                    Sistem Otomatik Tarih Hesaplar:{" "}
                    <span className="text-blue-500">Sipariş → Yükleme</span> |{" "}
                    <span className="text-indigo-500">Teslim = Sipariş + 1 Gün</span>
                </p>
            </footer>
        </div>
    );
}