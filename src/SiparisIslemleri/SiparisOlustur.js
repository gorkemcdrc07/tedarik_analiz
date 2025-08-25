// src/SiparisIslemleri/SiparisOlustur.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Download,
    Link as LinkIcon,
    ListChecks,
    IdCard,
    FileSpreadsheet,
    UploadCloud,
} from "lucide-react";
import * as XLSX from "xlsx";
import "./SiparisOlustur.css";
import supabase from "../supabaseClient";

/** --- Ayarlar --- **/
const DATA_TABLE = "Projeler"; // <-- VERİ BURADAN GELECEK

/** TABLODA KULLANILACAK GÜNCEL BAŞLIKLAR */
const HEADERS = [
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
    "Ambalaj  Tipi",
    "Brüt KG",
    "M3",
    "Desi",
];

/** Export/Import için zorunlu başlıklar */
const REQUIRED_EXPORT_HEADERS = [
    "Sipariş Tarihi",
    "Müşteri Sipariş No",
    "İstenilen Araç Tipi",
    "Açıklama",
    "Yükleme Firma Adı",
    "Alıcı Firma Cari Adı",
    "Teslim Firma Adres Adı",
].map((h) => h.replace("Yükleme Firma Adı", "Yükleme Firması Adı")); // senin başlıkla tam aynı kalsın

/** Supabase -> Tablo başlığı eşlemesi (overlay yapılacak alanlar) */
const FIELD_OVERLAY_MAP = {
    vkn: "Vkn",
    proje_id: "Proje", // Proje sütununa proje_id yazılacak
    Musteri_Siparis_No: "Müşteri Sipariş No",
    Alici_Firma_Cari_Unvani: "Alıcı Firma Cari Adı",
    Urun: "Ürün",
    Kap_Adet: "Kap Adet",
    Ambalaj_Tipi: "Ambalaj  Tipi", // (HEADERS'ta çift boşluk var)
    Brut_KG: "Brüt KG",
    Yukleme_Firma_Adres_Adi: "Yükleme Firması Adı",
};
const SELECT_COLS = Object.keys(FIELD_OVERLAY_MAP).join(", ");

const emptyRow = () => HEADERS.reduce((acc, key) => ({ ...acc, [key]: "" }), {});
const sortTr = (a, b) => String(a).localeCompare(String(b), "tr", { sensitivity: "base" });
const normalize = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/* ===== Tarih + Araç Tipi yardımcıları ===== */
/** Excel seri tarih -> Date (Excel 1900 epoch uyumlu) */
const excelSerialToDate = (val) => {
    const n = Number(val);
    if (!isFinite(n)) return null;
    const ms = n * 86400000;
    const d = new Date(Date.UTC(1899, 11, 30) + ms); // 1899-12-30 baz
    return isNaN(d.getTime()) ? null : d;
};
const tryParseDate = (val) => {
    if (val === null || val === undefined || val === "") return null;
    const d1 = excelSerialToDate(val);
    if (d1) return d1;
    const d2 = new Date(val);
    return isNaN(d2.getTime()) ? null : d2;
};
const toShortTR = (date) => (date ? date.toLocaleDateString("tr-TR") : "");
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

/** Satırdaki Sipariş/Yükleme/Teslim alanlarını doldur */
const enrichDatesOnRow = (row) => {
    const raw = row["Sipariş Tarihi"];
    const d = tryParseDate(raw);
    if (!d) return row;
    return {
        ...row,
        ["Sipariş Tarihi"]: toShortTR(d),
        ["Yükleme Tarihi"]: toShortTR(d),
        ["Teslim Tarihi"]: toShortTR(addDays(d, 1)),
    };
};

/** İstenilen Araç Tipi → kod (case-insensitive, TR locale) */
const mapVehicleTypeToCode = (val) => {
    const raw = normalize(val);
    if (!raw) return raw;
    const s = raw.toLocaleLowerCase("tr");
    if (s === "tır" || s === "tir") return "1";
    if (s === "kırkayak" || s === "kirkayak") return "2";
    if (s === "kamyon") return "3";
    if (s === "kamyonet") return "5";
    return raw;
};
const enrichVehicleOnRow = (row) => ({
    ...row,
    ["İstenilen Araç Tipi"]: mapVehicleTypeToCode(row["İstenilen Araç Tipi"]),
});

/** Hepsini tek yerden uygulayalım */
const enrichRow = (row) => enrichVehicleOnRow(enrichDatesOnRow(row));
/* ========================================= */

/* ====== EKLENDİ: Teslim_Noktalari için fuzzy eşleşme yardımcıları ====== */
const cleanAddr = (s) =>
    String(s ?? "")
        .toLocaleLowerCase("tr")
        .replace(/[\(\)\[\]\{\}\-_.]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const bigrams = (str) => {
    const s = str.replace(/\s+/g, "");
    const arr = [];
    for (let i = 0; i < Math.max(0, s.length - 1); i++) arr.push(s.slice(i, i + 2));
    return arr;
};
const diceCoefficient = (a, b) => {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const A = bigrams(a), B = bigrams(b);
    if (!A.length || !B.length) return 0;
    const map = new Map();
    for (const g of A) map.set(g, (map.get(g) ?? 0) + 1);
    let inter = 0;
    for (const g of B) {
        const c = map.get(g) ?? 0;
        if (c > 0) { inter++; map.set(g, c - 1); }
    }
    return (2 * inter) / (A.length + B.length);
};
const scoreSimilarity = (q, cand) => {
    if (!q || !cand) return 0;
    if (q === cand) return 1;
    if (q.includes(cand) || cand.includes(q)) return 0.95;
    return diceCoefficient(q, cand);
};
/* ======================================================================= */

export default function SiparisOlustur() {
    const [projeAdi, setProjeAdi] = useState("");
    const [rows, setRows] = useState([]); // Excel ile dolar; overlay ile güncellenir
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState("");
    const [lastFile, setLastFile] = useState(null);
    const fileInputRef = useRef(null);

    const [projects, setProjects] = useState([]); // {id, name}
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsError, setProjectsError] = useState("");

    const [overlayLoading, setOverlayLoading] = useState(false);

    const columns = useMemo(() => HEADERS, []);

    /* === EKLENDİ: Eşleşme onay modali durumu === */
    const [matchModalOpen, setMatchModalOpen] = useState(false);
    const [matchPreview, setMatchPreview] = useState({
        total: 0,
        matchedCount: 0,
        unmatchedCount: 0,
        samples: [], // {rowIndex, before, matchedAdresAdi, matchedAdresId, matchedCariId, score}
    });
    const [matchResults, setMatchResults] = useState([]); // her satır için eşleşme sonucu

    /** Projeleri yükle (id + Proje_Adi) -> dropdown için */
    useEffect(() => {
        const fetchProjects = async () => {
            setProjectsLoading(true);
            setProjectsError("");
            try {
                const { data, error } = await supabase
                    .from("Projeler")
                    .select("id, Proje_Adi");
                if (error) throw error;

                const list = (Array.isArray(data) ? data : [])
                    .map((x) => ({ id: x?.id, name: (x?.Proje_Adi ?? "").trim() }))
                    .filter((x) => x.id && x.name.length > 0)
                    .sort((a, b) => sortTr(a.name, b.name));

                setProjects(list);
            } catch (e) {
                setProjectsError(e.message || "Projeler alınırken hata oluştu.");
                setProjects([]);
            } finally {
                setProjectsLoading(false);
            }
        };

        fetchProjects();
    }, []);

    /** Excel içe aktarım */
    const isExcelFile = (file) =>
        /\.(xlsx|xlsm|xls)$/i.test(file.name) ||
        [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ].includes(file.type);

    const parseExcel = async (file) => {
        setError("");
        try {
            if (!projeAdi) throw new Error("Excel yüklemeden önce lütfen bir proje seçin.");
            if (!isExcelFile(file)) throw new Error("Lütfen .xlsx / .xls dosyası yükleyin.");

            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
            if (!aoa || aoa.length === 0) throw new Error("Boş sayfa görünüyor.");

            const [rawHeaders, ...body] = aoa;

            // Header eşleme
            const headerIndexMap = {};
            HEADERS.forEach((h) => {
                const idx = rawHeaders.findIndex((x) => normalize(x) === normalize(h));
                headerIndexMap[h] = idx; // -1 olabilir
            });

            // Zorunlu başlık kontrolü
            const missing = REQUIRED_EXPORT_HEADERS.filter((h) => headerIndexMap[h] === -1);
            if (missing.length) throw new Error(`Eksik başlık: ${missing.join(", ")}. Lütfen şablonu kullanın.`);

            const parsedRows = body
                .filter((row) => row.some((cell) => normalize(cell) !== ""))
                .map((row) => {
                    const obj = {};
                    HEADERS.forEach((h) => {
                        const idx = headerIndexMap[h];
                        obj[h] = idx >= 0 ? normalize(row[idx]) : "";
                    });
                    return enrichRow(obj); // <<< tarih + araç tipi
                })
                .map((r) => ({ ...r, Proje: projeAdi || "" })); // geçici görsel amaçlı

            // Excel yüklenince projeye ait satırları Projeler tablosundan çek ve uygula
            try {
                const incoming = await fetchProjectRows(projeAdi);
                const merged = applyOverlay(parsedRows, incoming);
                setRows(merged);
            } catch (er) {
                setRows(parsedRows);
                setError(er.message || "Proje verileri alınamadı (Excel yüklendi).");
            }

            setLastFile(file);
        } catch (e) {
            setRows([]);
            setError(e.message || "Excel okunamadı.");
        }
    };

    // Drag & drop
    const onDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        const f = e.dataTransfer.files?.[0];
        if (f) parseExcel(f);
    };
    const onDragOver = (e) => { e.preventDefault(); setDragActive(true); };
    const onDragLeave = () => setDragActive(false);
    const pickFile = () => fileInputRef.current?.click();
    const onFileChange = (e) => { const f = e.target.files?.[0]; if (f) parseExcel(f); e.target.value = ""; };

    /** Şablon indir / dışa aktar */
    const handleTemplateDownload = async () => {
        try {
            // 1) İlk sayfa: mevcut şablon
            const cols = REQUIRED_EXPORT_HEADERS;
            const wsData = [cols, ...[emptyRow()].map((r) => cols.map((c) => r[c] ?? ""))];
            const wsSablon = XLSX.utils.aoa_to_sheet(wsData);

            // 2) İkinci sayfa: DOKÜMAN (Teslim_Noktalari - tüm kayıtlar)
            let allData = [];
            const pageSize = 1000;

            // Önce toplam kayıt sayısını öğrenelim
            const { count, error: countError } = await supabase
                .from("Teslim_Noktalari")
                .select("*", { count: "exact", head: true });
            if (countError) throw countError;

            const total = count || 0;
            const totalPages = Math.ceil(total / pageSize);

            for (let page = 0; page < totalPages; page++) {
                const from = page * pageSize;
                const to = from + pageSize - 1;
                const { data, error } = await supabase
                    .from("Teslim_Noktalari")
                    .select("*")
                    .range(from, to);

                if (error) throw error;
                allData = allData.concat(data || []);
            }

            const docHeaders = allData.length ? Object.keys(allData[0]) : [];
            const wsDokuman = XLSX.utils.json_to_sheet(allData, { header: docHeaders });

            // 3) Çalışma kitabını oluştur ve iki sayfayı ekle
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, wsSablon, "Sablon");
            XLSX.utils.book_append_sheet(wb, wsDokuman, "DOKÜMAN");

            const iso = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Siparis_Sablon_${iso}.xlsx`);
        } catch (e) {
            setError(e.message || "Şablon indirilirken bir hata oluştu.");
        }
    };
    const handleExportExcel = () => {
        if (!projeAdi) {
            setError("Dışa aktarmadan önce lütfen bir proje seçin.");
            return;
        }
        if (!rows.length) {
            setError("Dışa aktarılacak veri bulunamadı.");
            return;
        }

        // Tabloyu ekrandaki sırayla, # kolonu dahil AOA olarak yaz
        const cols = ["#", ...columns]; // columns zaten HEADERS ile geliyor
        const aoa = [
            cols,
            ...rows.map((r, i) => [
                i + 1,
                ...columns.map((c) => r[c] ?? "")
            ]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tablo");

        const iso = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Siparisler_${projeAdi || "Proje"}_${iso}.xlsx`);
    };
    /** Proje satırlarını Projeler tablosundan çek (Proje_Adi eşleşmesi ile) */
    const fetchProjectRows = async (projectName) => {
        // Artık id ile değil, doğrudan proje_adi ile filtreliyoruz
        const { data, error } = await supabase
            .from(DATA_TABLE)
            .select(`${SELECT_COLS}, Proje_Adi`) // Proje_Adi da gelsin
            .eq("Proje_Adi", projectName);       // <-- KRİTİK: isim ile eşle

        if (error) throw error;
        return Array.isArray(data) ? data : [];
    };

    /** Overlay: tüm satırlara uygula (tek kayıt gelirse broadcast) + tarih & araç tipi düzelt */
    const applyOverlay = (prevRows, incoming) => {
        const outLen = Math.max(prevRows.length, incoming.length || 0);
        const hasAny = Array.isArray(incoming) && incoming.length > 0;

        const out = Array.from({ length: outLen }).map((_, i) => {
            const base = prevRows[i] ? { ...prevRows[i] } : emptyRow();

            // 1) Birden çok kayıt varsa index’e göre sırala
            // 2) Tek kayıt varsa tüm satırlara aynı kaydı uygula (broadcast)
            const rec = hasAny
                ? (incoming[i] ?? incoming[incoming.length - 1])
                : null;

            if (rec) {
                Object.entries(FIELD_OVERLAY_MAP).forEach(([src, dest]) => {
                    if (src === "proje_id") {
                        base[dest] = String(rec.proje_id ?? "");
                    } else {
                        base[dest] = normalize(rec[src] ?? base[dest]);
                    }
                });
            }
            return enrichRow(base); // <<< tarih + araç tipi burada da
        });

        return out;
    };

    /** Manuel eşleştirme butonu (overlay + adres fuzzy eşleşme) */
    const overlayProjectData = (incoming) => {
        setRows((prev) => applyOverlay(prev, incoming));
    };

    /* === EKLENDİ: EŞLEŞME YAP — fuzzy adres eşleştirme + onay modalı === */
    const handleEslesmeYap = async () => {
        try {
            if (!projeAdi) {
                setError("Eşleşme yapmadan önce lütfen bir proje seçin.");
                return;
            }
            setError("");
            setOverlayLoading(true);

            // 1) Varsa önce projeye göre overlay’i uygula (mevcut davranışı koruyoruz)
            try {
                const incoming = await fetchProjectRows(projeAdi);
                if (incoming && incoming.length) {
                    const merged = applyOverlay(rows, incoming);
                    setRows(merged);
                }
            } catch (_) {
                // Proje overlay alınamazsa devam: adres eşleştirme yine çalışsın
            }

            // 2) Teslim_Noktalari listesini çek
            const { data, error } = await supabase
                .from("Teslim_Noktalari")
                .select("adres_id, adres_adi, cari_hesap_id");
            if (error) throw error;

            const adresler = (Array.isArray(data) ? data : []).map((x) => ({
                adres_id: x?.adres_id ?? "",
                adres_adi: x?.adres_adi ?? "",
                cari_hesap_id: x?.cari_hesap_id ?? "",
                _norm: cleanAddr(x?.adres_adi ?? ""),
            }));

            // 3) Tablodaki her satır için en iyi eşleşmeyi bul
            const THRESHOLD = 0.6;
            const currentRows = rows; // setRows async olduğu için state üzerinden al
            const results = currentRows.map((row, idx) => {
                const qRaw = row["Teslim Firma Adres Adı"];
                const qNorm = cleanAddr(qRaw);
                if (!qNorm) return { rowIndex: idx, ok: false, before: qRaw, score: 0 };
                let best = null, bestScore = 0;
                for (const a of adresler) {
                    const s = scoreSimilarity(qNorm, a._norm);
                    if (s > bestScore) { bestScore = s; best = a; }
                }
                if (best && bestScore >= THRESHOLD) {
                    return {
                        rowIndex: idx,
                        ok: true,
                        score: bestScore,
                        before: qRaw,
                        matchedAdresAdi: best.adres_adi,
                        matchedAdresId: best.adres_id,
                        matchedCariId: best.cari_hesap_id,
                    };
                }
                return { rowIndex: idx, ok: false, before: qRaw, score: bestScore };
            });

            const matched = results.filter(r => r.ok);
            setMatchResults(results);
            setMatchPreview({
                total: currentRows.length,
                matchedCount: matched.length,
                unmatchedCount: currentRows.length - matched.length,
                samples: matched.slice(0, 8).map(r => ({
                    rowIndex: r.rowIndex,
                    before: r.before,
                    matchedAdresAdi: r.matchedAdresAdi,
                    matchedAdresId: r.matchedAdresId,
                    matchedCariId: r.matchedCariId,
                    score: r.score,
                })),
            });
            setMatchModalOpen(true);
        } catch (e) {
            setError(e.message || "Eşleşme sırasında hata oluştu.");
        } finally {
            setOverlayLoading(false);
        }
    };

    const confirmApplyMatches = () => {
        setRows(prev => {
            const byIndex = new Map();
            for (const r of matchResults) if (r.ok) byIndex.set(r.rowIndex, r);
            return prev.map((row, i) => {
                const m = byIndex.get(i);
                if (!m) return row;
                const next = { ...row };
                // İSTEDİĞİN GİBİ: adres_id yaz, cari_hesap_id’yi Alıcı Firma Cari Adı’na yaz
                next["Teslim Firma Adres Adı"] = String(m.matchedAdresId ?? "");
                next["Alıcı Firma Cari Adı"] = String(m.matchedCariId ?? "");
                return next;
            });
        });
        setMatchModalOpen(false);
    };

    const cancelMatches = () => setMatchModalOpen(false);
    /* === /EKLENDİ === */

    const handleEslesmeIdGetir = () => {
        if (!projeAdi) {
            setError("Eşleşme ID’lerini getirmeden önce lütfen bir proje seçin.");
            return;
        }
        const fakeId = Math.random().toString(36).slice(2, 10).toUpperCase();
        alert(`Eşleşme ID'si: ${fakeId}`);
    };

    return (
        <div className="so-page">
            <div className="so-header">
                <div>
                    <h1 className="so-title">Sipariş Oluştur</h1>
                    <div className="so-subtitle">SiparisOlustur.js</div>
                </div>
            </div>

            {/* ÜSTTE AYRIK İKİ PANEL */}
            <div className="so-grid so-grid--two">
                {/* Sol panel */}
                <div className="so-card so-equal">
                    <label className="so-label">
                        Proje Adı <span style={{ color: "#e11d48" }}>*</span>
                    </label>
                    <select
                        className="so-input"
                        value={projeAdi}
                        onChange={(e) => setProjeAdi(e.target.value)}
                        disabled={projectsLoading}
                    >
                        <option value="">Seçiniz</option>
                        {projectsLoading && <option>Yükleniyor...</option>}
                        {!projectsLoading && projectsError && (
                            <option disabled>Hata: {projectsError}</option>
                        )}
                        {!projectsLoading &&
                            !projectsError &&
                            projects.map((p) => (
                                <option key={p.id} value={p.name}>
                                    {p.name}
                                </option>
                            ))}
                    </select>
                    <p className="so-help">
                        Proje seçmek zorunludur. Excel yükleyebilir veya “Eşleşme Yap” ile
                        projedeki alanları mevcut satırlara yerleştirebilirsiniz.
                    </p>
                </div>

                {/* Sağ panel */}
                <div className="so-card so-equal">
                    <div className="so-actions">
                        <button className="so-btn so-btn-primary" onClick={handleTemplateDownload}>
                            <Download size={18} /> Şablonu İndir
                        </button>
                        <button className="so-btn" onClick={handleEslesmeYap} disabled={!projeAdi || overlayLoading}>
                            <LinkIcon size={18} /> {overlayLoading ? "Eşleştiriliyor..." : "Eşleşme Yap"}
                        </button>
                        <button className="so-btn" onClick={handleEslesmeIdGetir} disabled={!projeAdi}>
                            <IdCard size={18} /> Eşleşme ID’lerini Getir
                        </button>
                        <button className="so-btn" onClick={handleExportExcel} disabled={!rows.length || !projeAdi}>
                            <FileSpreadsheet size={18} /> Dışarı Excel Aktarma
                        </button>
                    </div>
                </div>
            </div>

            {/* ALT PANEL */}
            <div className="so-table-card">
                <div className="so-table-header">
                    <ListChecks size={18} /> <span>Şablon</span>
                    <span className="so-table-sub">
                        (İçerik Excel ile yüklenir; proje verileri tüm satırlara uygulanır. Sipariş = kısa tarih, Yükleme = Sipariş, Teslim = +1 gün. Araç tipi: TIR→1, KIRKAYAK→2, KAMYON→3, KAMYONET→5)
                    </span>
                </div>

                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead>
                            <tr>
                                <th className="so-index">#</th>
                                {columns.map((c) => (
                                    <th key={c}>{c}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr className="so-drop-row">
                                    <td className="so-index" colSpan={columns.length + 1}>
                                        <div
                                            className={`so-drop-in-table ${dragActive ? "active" : ""}`}
                                            onDrop={onDrop}
                                            onDragOver={onDragOver}
                                            onDragLeave={onDragLeave}
                                            onDragEnd={onDragLeave}
                                            onDragExit={onDragLeave}
                                            onClick={pickFile}
                                            role="button"
                                            aria-label="Excel sürükleyip bırak veya tıklayıp seç"
                                            tabIndex={0}
                                        >
                                            <UploadCloud size={30} />
                                            <div className="so-drop-title">
                                                Excel’i buraya sürükleyip bırakın
                                            </div>
                                            <div className="so-drop-sub">
                                                ya da <b>tıklayın</b> (.xlsx / .xls)
                                            </div>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".xlsx,.xls,.xlsm"
                                                onChange={onFileChange}
                                                hidden
                                                disabled={!projeAdi}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, rowIdx) => (
                                    <tr key={rowIdx}>
                                        <td className="so-index">{rowIdx + 1}</td>
                                        {columns.map((col) => (
                                            <td key={`${rowIdx}-${col}`}>
                                                <div className="so-cell-text">{row[col]}</div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="so-footnote">
                    İpucu: “Şablonu İndir” ile başlıkları hazır Excel elde edip, doldurduktan
                    sonra buraya yükleyebilirsiniz.
                </div>

                {error && <p className="so-error">{error}</p>}
                {lastFile && (
                    <p className="so-help">
                        Yüklü: <b>{lastFile.name}</b>
                    </p>
                )}
            </div>

            {/* === EKLENDİ: Eşleşme onay modali === */}
            {matchModalOpen && (
                <div className="so-modal-backdrop" role="dialog" aria-modal="true">
                    <div className="so-modal">
                        <div className="so-modal__body">
                            <h3 className="so-modal__title">Adres Eşleşme Özeti</h3>

                            <p className="so-modal__kpi">
                                Toplam satır: <b>{matchPreview.total}</b>
                                {" — "}Eşleşen: <b className="good">{matchPreview.matchedCount}</b>
                                {" — "}Eşleşmeyen: <b className="bad">{matchPreview.unmatchedCount}</b>
                            </p>

                            {matchPreview.samples?.length > 0 && (
                                <>
                                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Örnek eşleşmeler:</div>
                                    <ul className="so-modal__list">
                                        {matchPreview.samples.map((s) => (
                                            <li key={s.rowIndex}>
                                                <code>{s.before}</code> → <code>{s.matchedAdresAdi}</code>
                                                {" "} (adres_id: <b>{s.matchedAdresId}</b>, cari_hesap_id: <b>{s.matchedCariId}</b>)
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}

                            {matchPreview.unmatchedSamples?.length > 0 && (
                                <>
                                    <div style={{ fontWeight: 600, marginTop: 12, marginBottom: 6 }}>
                                        Eşleşmeyen örnekler (en yakın aday ve skor):
                                    </div>
                                    <ul className="so-modal__list">
                                        {matchPreview.unmatchedSamples.map((s) => (
                                            <li key={`un-${s.rowIndex}`}>
                                                <code>{s.before || "—"}</code>
                                                {"  →  "}
                                                {s.bestTryAdresAdi ? (
                                                    <>
                                                        en yakın: <code>{s.bestTryAdresAdi}</code>
                                                        {" "} (adres_id: <b>{s.bestTryAdresId || "—"}</b>,
                                                        {" "} cari_hesap_id: <b>{s.bestTryCariId || "—"}</b>,
                                                        {" "} skor: {s.score.toFixed(2)})
                                                    </>
                                                ) : "uygun aday bulunamadı"}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="so-modal__hint">
                                        İpucu: Benzerlik eşiği şu anda <b>0.40</b>.
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="so-modal__actions">
                            <button className="so-btn" onClick={() => setMatchModalOpen(false)}>Vazgeç</button>
                            <button className="so-btn so-btn-primary" onClick={confirmApplyMatches}>
                                Onayla ve Uygula
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* === /MODAL === */}
        </div>
    );
}
