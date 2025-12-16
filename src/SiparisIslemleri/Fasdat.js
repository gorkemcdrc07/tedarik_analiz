import React, { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";

/* === Yardımcılar === */
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
        const utcValue = utcDays * 86400;
        const dateInfo = new Date(utcValue * 1000);
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

/* === Hedef sütunlar === */
const TARGET_COLUMNS = [
    "Vkn", "Proje", "Sipariş Tarihi", "Yükleme Tarihi", "Teslim Tarihi", "Müşteri Sipariş No", "Müşteri Referans No",
    "İstenilen Araç Tipi", "Açıklama", "Yükleme Firması Adı", "Alıcı Firma Cari Adı", "Teslim Firma Adres Adı",
    "İrsaliye No", "İrsaliye Miktarı", "Ürün", "Kap Adet", "Ambalaj Tipi", "Brüt KG", "M3", "Desi",
];

/* === Kolon genişlikleri (px) === */
const COL_W = {
    "Vkn": 100, "Proje": 90,
    "Sipariş Tarihi": 120, "Yükleme Tarihi": 120, "Teslim Tarihi": 120,
    "Müşteri Sipariş No": 160, "Müşteri Referans No": 160,
    "İstenilen Araç Tipi": 150, "Açıklama": 260,
    "Yükleme Firması Adı": 220, "Alıcı Firma Cari Adı": 200, "Teslim Firma Adres Adı": 240,
    "İrsaliye No": 140, "İrsaliye Miktarı": 140,
    "Ürün": 90, "Kap Adet": 90, "Ambalaj Tipi": 120, "Brüt KG": 120, "M3": 90, "Desi": 90,
};

/* === Otomatik sabitler === */
const AUTO = {
    VKN: "3850012676",
    PROJE: "747",
    URUN: "176",
    KAP_ADET: "1",
    AMBALAJ_TIPI: "1",
    BRUT_KG: "25000",
};

/* === Metin normalize (içerik karşılaştırmaları için) === */
const normVal = (v) =>
    String(v ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleUpperCase("tr-TR");

/* === Özel eşleştirmeler === */
// 1) Yükleme Firması Adı -> belirli yazıları görürsek ID yaz
function mapYuklemeFirmasiToId(val) {
    const s = normVal(val);
    if (s.includes("ATAKEY SARNIÇ KÖYÜ")) return "35989";
    if (s.includes("ATAKEY TOMARZA")) return "35990";
    if (s.includes("KARAPINAR PATATES TARLA")) return "36114";
    if (s.includes("ATAKEY EĞRİBAYAT")) return "27682";
    if (s.includes("FASDAT KARATAY YARMA TARLA")) return "35837";
    if (s.includes("TOPRAKLIK MEVKİ KONYA")) return "36341";
    if (s.includes("KARADAYI KÖYÜ BÜNYAN")) return "36420";
    if (s.includes("HHG PATATES TARLA")) return "35587";
    if (s.includes("EMİRGAZİ TARLA")) return "36308";
    if (s.includes("BEYLİKOVA KÖYÜ PATATES")) return "36477";
    if (s.includes("ATAKEY DEVELİ PATATES")) return "36746";
    if (s.includes("FASDAT BALA PATATES")) return "36597";
    if (s.includes("ATAKEY HACINUMAN KÖYÜ")) return "36747";
    if (s.includes("MERAM BORUKTOLU SOĞAN")) return "36497";
    if (s.includes("YÜKSECİK MEVKİ PATATES TARLA")) return "36799";
    if (s.includes("POLATLI YÜZÜKBAŞI KÖYÜ PATATES")) return "36853";
    if (s.includes("MEZGİTLİ PATATES TARLA")) return "36537";
    if (s.includes("PATNOS ÜRKÜT KÖYÜ")) return "36855";
    if (s.includes("AHLAT TAŞHARMAN KÖYÜ")) return "36856";
    if (s.includes("ADİLCEVAZ GÖZDÜZÜ KÖYÜ")) return "36857";
    return val ?? ""; // eşleşme yoksa orijinali koru
}

// 2) Teslim Firma Adres Adı “ATAKEY AFYON” ise: adres = 34732, alıcı cari = 21828
function mapTeslimAdresAndMaybeCari(teslimAdres, aliciCari) {
    const s = normVal(teslimAdres);
    if (s.includes("ATAKEY AFYON")) {
        return { teslimAdres: "34732", aliciCari: "21828" };
    }
    return { teslimAdres: teslimAdres ?? "", aliciCari: aliciCari ?? "" };
}

export default function Fasdat() {
    const [rows, setRows] = useState([]);
    const [error, setError] = useState("");
    const [fileName, setFileName] = useState("");

    const onFiles = useCallback(async (file) => {
        setError("");
        setFileName(file?.name || "");
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
            if (!json.length) { setRows([]); setError("Excel sayfasında veri bulunamadı."); return; }

            const mapped = json.map((r) => {
                // Kaynaktan oku
                const siparisRaw = getField(r, "Sipariş Tarihi");
                const musteriSipNo = getField(r, "Müşteri Sipariş No");
                const aracTipi = getField(r, "İstenilen Araç Tipi");
                const aciklama = getField(r, "Açıklama");
                let yuklemeFirma = getField(r, "Yükleme Firması Adı");
                let aliciCari = getField(r, "Alıcı Firma Cari Adı");
                let teslimAdres = getField(r, "Teslim Firma Adres Adı");

                // Tarihler
                const dSip = parseExcelDate(siparisRaw);
                const dYuk = dSip ? new Date(dSip) : null;
                const dTes = dSip ? new Date(dSip.getTime() + 24 * 60 * 60 * 1000) : null;

                // Özel kurallar:
                yuklemeFirma = mapYuklemeFirmasiToId(yuklemeFirma);
                const ta = mapTeslimAdresAndMaybeCari(teslimAdres, aliciCari);
                teslimAdres = ta.teslimAdres;
                aliciCari = ta.aliciCari;

                return {
                    "Vkn": AUTO.VKN,
                    "Proje": AUTO.PROJE,
                    "Sipariş Tarihi": formatDateTR(dSip),
                    "Yükleme Tarihi": formatDateTR(dYuk),   // = Sipariş Tarihi
                    "Teslim Tarihi": formatDateTR(dTes),    // = +1 gün
                    "Müşteri Sipariş No": musteriSipNo || "",
                    "Müşteri Referans No": "",
                    "İstenilen Araç Tipi": aracTipi || "",  // kaynaktaki değer
                    "Açıklama": aciklama || "",
                    "Yükleme Firması Adı": yuklemeFirma || "",
                    "Alıcı Firma Cari Adı": aliciCari || "",
                    "Teslim Firma Adres Adı": teslimAdres || "",
                    "İrsaliye No": "",
                    "İrsaliye Miktarı": "",
                    "Ürün": AUTO.URUN,
                    "Kap Adet": AUTO.KAP_ADET,
                    "Ambalaj Tipi": AUTO.AMBALAJ_TIPI,
                    "Brüt KG": AUTO.BRUT_KG,
                    "M3": "",
                    "Desi": "",
                };
            });

            setRows(mapped);
        } catch (e) {
            console.error(e);
            setError("Dosya okunurken bir hata oluştu. Lütfen geçerli bir Excel dosyası yükleyin.");
        }
    }, []);

    const onDrop = useCallback((e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) onFiles(e.dataTransfer.files[0]); }, [onFiles]);
    const onDragOver = useCallback((e) => { e.preventDefault(); }, []);

    const downloadExcel = useCallback(() => {
        if (!rows.length) return;
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows, { header: TARGET_COLUMNS, skipHeader: false });
        XLSX.utils.book_append_sheet(wb, ws, "Fasdat");
        XLSX.writeFile(wb, `fasdat_${Date.now()}.xlsx`);
    }, [rows]);

    const headerCells = useMemo(
        () => TARGET_COLUMNS.map((c) => (
            <th
                key={c}
                className="px-3 py-2 text-left text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis
                   text-slate-900 dark:text-white"
                style={{ width: COL_W[c] ?? 140 }}
                title={c}
            >
                {c}
            </th>
        )),
        []
    );
    /*deneme*/

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Fasdat</h1>
                    <p className="text-sm text-gray-600 dark:text-slate-300">
                        Excel’i sürükleyip bırakın. “Sipariş Tarihi” → Sipariş &amp; Yükleme, “Teslim Tarihi” = +1 gün.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="px-3 py-2 rounded-xl shadow border cursor-pointer text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        Dosya Seç
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files && onFiles(e.target.files[0])} />
                    </label>
                    <button
                        onClick={downloadExcel}
                        disabled={!rows.length}
                        className="px-3 py-2 rounded-xl shadow border text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                        Excel indir
                    </button>
                </div>
            </div>

            {/* Sürükle-bırak */}
            <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                className="border-2 border-dashed rounded-2xl p-10 text-center hover:bg-gray-50 transition shadow-sm
                   dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
                <p className="text-base dark:text-white">
                    Dosyanızı buraya <span className="font-medium">sürükleyip bırakın</span>
                    {fileName && <> — yüklendi: <span className="font-semibold">{fileName}</span></>}
                </p>
                <p className="text-xs text-gray-500 mt-2 dark:text-slate-400">Destek: .xlsx, .xls</p>
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800">
                    {error}
                </div>
            )}

            {/* Tablo paneli */}
            <div className="rounded-2xl border shadow-sm h-[560px] overflow-auto bg-white dark:bg-slate-900 dark:border-slate-700">
                <table className="min-w-[1200px] w-full text-sm text-slate-900 dark:text-white">
                    <colgroup>
                        {TARGET_COLUMNS.map((c) => (
                            <col key={c} style={{ width: COL_W[c] ?? 140 }} />
                        ))}
                    </colgroup>
                    <thead className="bg-gray-100 dark:bg-slate-800 sticky top-0 z-10">
                        <tr>{headerCells}</tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td className="px-3 py-4 text-gray-500 dark:text-slate-300" colSpan={TARGET_COLUMNS.length}>
                                    Henüz veri yok. Bir Excel yükleyin.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => (
                                <tr key={idx} className="odd:bg-white even:bg-gray-50 dark:odd:bg-slate-900 dark:even:bg-slate-800">
                                    {TARGET_COLUMNS.map((col) => (
                                        <td
                                            key={col}
                                            className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-slate-900 dark:text-white"
                                            title={row[col] ?? ""}
                                        >
                                            {row[col] ?? ""}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
