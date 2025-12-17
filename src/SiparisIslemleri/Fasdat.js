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
    Table as TableIcon
} from "lucide-react";

/* === Yardımcı Fonksiyonlar (Mantık Aynı Kaldı) === */
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
        const d = +m[1], mo = +m[2] - 1;
        let y = +m[3]; if (y < 100) y += 2000;
        return new Date(y, mo, d);
    }
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
}
function formatDateTR(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat(TR_LOCALE, { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const TARGET_COLUMNS = [
    "Vkn", "Proje", "Sipariş Tarihi", "Yükleme Tarihi", "Teslim Tarihi", "Müşteri Sipariş No", "Müşteri Referans No",
    "İstenilen Araç Tipi", "Açıklama", "Yükleme Firması Adı", "Alıcı Firma Cari Adı", "Teslim Firma Adres Adı",
    "İrsaliye No", "İrsaliye Miktarı", "Ürün", "Kap Adet", "Ambalaj Tipi", "Brüt KG", "M3", "Desi",
];

const AUTO = { VKN: "3850012676", PROJE: "747", URUN: "176", KAP_ADET: "1", AMBALAJ_TIPI: "1", BRUT_KG: "25000" };

const normVal = (v) => String(v ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");

function mapYuklemeFirmasiToId(val) {
    const s = normVal(val);
    const mapping = {
        "ATAKEY SARNIÇ KÖYÜ": "35989", "ATAKEY TOMARZA": "35990", "KARAPINAR PATATES TARLA": "36114",
        "ATAKEY EĞRİBAYAT": "27682", "FASDAT KARATAY YARMA TARLA": "35837", "TOPRAKLIK MEVKİ KONYA": "36341",
        "KARADAYI KÖYÜ BÜNYAN": "36420", "HHG PATATES TARLA": "35587", "EMİRGAZİ TARLA": "36308",
        "BEYLİKOVA KÖYÜ PATATES": "36477", "ATAKEY DEVELİ PATATES": "36746", "FASDAT BALA PATATES": "36597",
        "ATAKEY HACINUMAN KÖYÜ": "36747", "MERAM BORUKTOLU SOĞAN": "36497", "YÜKSECİK MEVKİ PATATES TARLA": "36799",
        "POLATLI YÜZÜKBAŞI KÖYÜ PATATES": "36853", "MEZGİTLİ PATATES TARLA": "36537", "PATNOS ÜRKÜT KÖYÜ": "36855",
        "AHLAT TAŞHARMAN KÖYÜ": "36856", "ADİLCEVAZ GÖZDÜZÜ KÖYÜ": "36857"
    };
    for (const key in mapping) { if (s.includes(key)) return mapping[key]; }
    return val ?? "";
}

export default function Fasdat() {
    const [rows, setRows] = useState([]);
    const [error, setError] = useState("");
    const [fileName, setFileName] = useState("");
    const [isDragging, setIsDragging] = useState(false);

    const onFiles = useCallback(async (file) => {
        if (!file) return;
        setError("");
        setFileName(file.name);
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

            if (!json.length) throw new Error("Excel sayfasında veri bulunamadı.");

            const mapped = json.map((r) => {
                const sipRaw = getField(r, "Sipariş Tarihi");
                const dSip = parseExcelDate(sipRaw);
                const dYuk = dSip ? new Date(dSip) : null;
                const dTes = dSip ? new Date(dSip.getTime() + 86400000) : null;

                let yf = mapYuklemeFirmasiToId(getField(r, "Yükleme Firması Adı"));
                let ta = getField(r, "Teslim Firma Adres Adı");
                let ac = getField(r, "Alıcı Firma Cari Adı");

                if (normVal(ta).includes("ATAKEY AFYON")) {
                    ta = "34732"; ac = "21828";
                }

                return {
                    "Vkn": AUTO.VKN, "Proje": AUTO.PROJE,
                    "Sipariş Tarihi": formatDateTR(dSip), "Yükleme Tarihi": formatDateTR(dYuk),
                    "Teslim Tarihi": formatDateTR(dTes), "Müşteri Sipariş No": getField(r, "Müşteri Sipariş No"),
                    "Müşteri Referans No": "", "İstenilen Araç Tipi": getField(r, "İstenilen Araç Tipi"),
                    "Açıklama": getField(r, "Açıklama"), "Yükleme Firması Adı": yf,
                    "Alıcı Firma Cari Adı": ac, "Teslim Firma Adres Adı": ta,
                    "İrsaliye No": "", "İrsaliye Miktarı": "", "Ürün": AUTO.URUN,
                    "Kap Adet": AUTO.KAP_ADET, "Ambalaj Tipi": AUTO.AMBALAJ_TIPI,
                    "Brüt KG": AUTO.BRUT_KG, "M3": "", "Desi": "",
                };
            });
            setRows(mapped);
        } catch (e) {
            setError(e.message || "Dosya okuma hatası.");
        }
    }, []);

    const downloadExcel = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows, { header: TARGET_COLUMNS });
        XLSX.utils.book_append_sheet(wb, ws, "Fasdat_Formatted");
        XLSX.writeFile(wb, `Fasdat_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const reset = () => { setRows([]); setFileName(""); setError(""); };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] p-4 md:p-8 font-sans transition-colors duration-300">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-6 rounded-3xl border border-white dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none">
                            <FileSpreadsheet className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">Fasdat Veri Dönüştürücü</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Lojistik formatlama ve otomatik ID eşleştirme paneli</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {rows.length > 0 && (
                            <button onClick={reset} className="p-2.5 text-slate-400 hover:text-rose-500 transition-colors bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-700">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={downloadExcel}
                            disabled={!rows.length}
                            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 shadow-lg shadow-slate-200 dark:shadow-blue-900/20"
                        >
                            <Download className="w-4 h-4" /> Excel İndir
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="grid grid-cols-1 gap-6">

                    {/* Upload Zone */}
                    {!rows.length ? (
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); onFiles(e.dataTransfer.files[0]); }}
                            className={`relative group border-2 border-dashed rounded-[2.5rem] p-16 transition-all duration-500 overflow-hidden
                                ${isDragging ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 scale-[0.99]' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50'}
                                hover:border-blue-400 dark:hover:border-blue-500/50 shadow-2xl shadow-slate-200/40 dark:shadow-none`}
                        >
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => onFiles(e.target.files[0])} />
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-full group-hover:scale-110 transition-transform duration-500">
                                    <UploadCloud className={`w-12 h-12 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-slate-700 dark:text-slate-200">Excel dosyasını buraya bırakın</p>
                                    <p className="text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest text-[10px] font-black">veya tıklayarak seçin</p>
                                </div>
                                <div className="flex gap-2 text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full">
                                    <span className="text-blue-500">.XLSX</span>
                                    <span>.XLS</span>
                                    <span>.CSV</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Data Stats & Success */
                        <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            <div className="flex-1">
                                <p className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">Başarıyla İşlendi</p>
                                <p className="text-emerald-600/70 dark:text-emerald-500/60 text-xs font-medium">{fileName} — {rows.length} satır hazır.</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-shake">
                            <AlertCircle className="w-5 h-5 text-rose-500" />
                            <p className="text-rose-600 dark:text-rose-400 font-bold text-sm">{error}</p>
                        </div>
                    )}

                    {/* Table View */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="flex items-center gap-2">
                                <TableIcon className="w-4 h-4 text-blue-500" />
                                <span className="text-xs font-black uppercase tracking-tighter text-slate-500">Önizleme Paneli</span>
                            </div>
                            <span className="px-3 py-1 bg-white dark:bg-slate-950 rounded-lg text-[10px] font-bold shadow-sm dark:text-slate-400 tracking-widest">
                                {rows.length} KAYIT
                            </span>
                        </div>

                        <div className="overflow-x-auto h-[500px] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
                                    <tr>
                                        {TARGET_COLUMNS.map((col) => (
                                            <th key={col} className="px-5 py-4 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b dark:border-slate-800">
                                                <div className="whitespace-nowrap">{col}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {rows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-colors group">
                                            {TARGET_COLUMNS.map((col) => (
                                                <td key={col} className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                    <span className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                        {row[col] || "-"}
                                                    </span>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={TARGET_COLUMNS.length} className="py-32 text-center">
                                                <div className="flex flex-col items-center opacity-20">
                                                    <FileText className="w-16 h-16 mb-4" />
                                                    <p className="font-bold tracking-tighter">Görüntülenecek veri bulunmuyor</p>
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

            {/* Floating Hint */}
            <footer className="max-w-7xl mx-auto mt-6 px-6 py-4 bg-white/30 dark:bg-slate-800/20 backdrop-blur rounded-2xl border border-white/20 text-center">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                    Sistem Otomatik Tarih Hesaplar: <span className="text-blue-500">Sipariş → Yükleme</span> | <span className="text-indigo-500">Teslim = Sipariş + 1 Gün</span>
                </p>
            </footer>
        </div>
    );
}