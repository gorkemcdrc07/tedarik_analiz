import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Download,
    Link as LinkIcon,
    ListChecks,
    FileSpreadsheet,
    UploadCloud,
    Trash2,
    FolderKanban,
    Sparkles,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Zap,
    Shield,
} from "lucide-react";
import * as XLSX from "xlsx";
import "./SiparisOlustur.css";
import supabase from "../supabaseClient";

const DATA_TABLE = "Projeler";

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

const REQUIRED_EXPORT_HEADERS = [
    "Sipariş Tarihi",
    "Müşteri Sipariş No",
    "İstenilen Araç Tipi",
    "Açıklama",
    "Yükleme Firma Adı",
    "Alıcı Firma Cari Adı",
    "Teslim Firma Adres Adı",
].map((h) => h.replace("Yükleme Firma Adı", "Yükleme Firması Adı"));

const FIELD_OVERLAY_MAP = {
    vkn: "Vkn",
    proje_id: "Proje",
    Musteri_Siparis_No: "Müşteri Sipariş No",
    Alici_Firma_Cari_Unvani: "Alıcı Firma Cari Adı",
    Urun: "Ürün",
    Kap_Adet: "Kap Adet",
    Ambalaj_Tipi: "Ambalaj  Tipi",
    Brut_KG: "Brüt KG",
    Yukleme_Firma_Adres_Adi: "Yükleme Firması Adı",
};

const SELECT_COLS = Object.keys(FIELD_OVERLAY_MAP).join(", ");
const BALLOG_CARI_ID = "63625";

const emptyRow = () => HEADERS.reduce((acc, key) => ({ ...acc, [key]: "" }), {});
const sortTr = (a, b) => String(a).localeCompare(String(b), "tr", { sensitivity: "base" });
const normalize = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const excelSerialToDate = (val) => {
    const n = Number(val);
    if (!isFinite(n)) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return isNaN(d.getTime()) ? null : d;
};

const tryParseDate = (val) => {
    if (val === null || val === undefined || val === "") return null;
    const d1 = excelSerialToDate(val);
    if (d1) return d1;
    const raw = String(val).trim();
    const trMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (trMatch) {
        const [, day, month, year] = trMatch;
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        return isNaN(d.getTime()) ? null : d;
    }
    const d2 = new Date(raw);
    return isNaN(d2.getTime()) ? null : d2;
};

const toShortTR = (date) => (date ? date.toLocaleDateString("tr-TR") : "");
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

const enrichDatesOnRow = (row) => {
    const d = tryParseDate(row["Sipariş Tarihi"]);
    if (!d) return row;
    return {
        ...row,
        ["Sipariş Tarihi"]: toShortTR(d),
        ["Yükleme Tarihi"]: toShortTR(d),
        ["Teslim Tarihi"]: toShortTR(addDays(d, 1)),
    };
};

const mapVehicleTypeToCode = (val) => {
    const s = normalize(val).toLocaleLowerCase("tr");
    if (!s) return s;
    if (s === "tır" || s === "tir") return "1";
    if (s === "kırkayak" || s === "kirkayak") return "2";
    if (s === "kamyon") return "3";
    if (s === "kamyonet") return "5";
    return normalize(val);
};

const enrichRow = (row) => ({
    ...enrichDatesOnRow(row),
    ["İstenilen Araç Tipi"]: mapVehicleTypeToCode(row["İstenilen Araç Tipi"]),
});

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
    const A = bigrams(a);
    const B = bigrams(b);
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

/* ── Template Download Progress Modal ── */
function DownloadProgressModal({ phase, progress, onClose }) {
    const steps = [
        { key: "template", label: "Şablon hazırlanıyor" },
        { key: "fetch", label: "Teslimat noktaları çekiliyor" },
        { key: "build", label: "Excel dosyası oluşturuluyor" },
        { key: "done", label: "İndirme tamamlandı" },
    ];
    const currentIdx = steps.findIndex((s) => s.key === phase);

    return (
        <div className="so-backdrop">
            <div className="so-dl-modal">
                <div className="so-dl-modal__icon">
                    {phase === "done" ? (
                        <CheckCircle2 size={32} className="so-dl-modal__icon--done" />
                    ) : (
                        <div className="so-dl-spinner" />
                    )}
                </div>
                <div className="so-dl-modal__title">
                    {phase === "done" ? "Hazır!" : "Şablon indiriliyor"}
                </div>
                <div className="so-dl-modal__sub">
                    {phase === "done"
                        ? "Dosya bilgisayarınıza kaydedildi."
                        : steps.find((s) => s.key === phase)?.label}
                </div>

                <div className="so-dl-progress-track">
                    <div
                        className="so-dl-progress-fill"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="so-dl-pct">{Math.round(progress)}%</div>

                <div className="so-dl-steps">
                    {steps.map((s, i) => (
                        <div
                            key={s.key}
                            className={`so-dl-step ${i < currentIdx ? "done" : i === currentIdx ? "active" : "pending"}`}
                        >
                            <span className="so-dl-step__dot" />
                            <span className="so-dl-step__label">{s.label}</span>
                        </div>
                    ))}
                </div>

                {phase === "done" && (
                    <button className="so-btn so-btn--primary so-dl-close" onClick={onClose}>
                        Tamam
                    </button>
                )}
            </div>
        </div>
    );
}

/* ── BALLOG Banner ── */
function BallogBanner() {
    return (
        <div className="so-ballog-banner">
            <div className="so-ballog-banner__glow" />
            <div className="so-ballog-banner__content">
                <div className="so-ballog-banner__left">
                    <span className="so-ballog-badge">
                        <Zap size={12} />
                        BALLOG
                    </span>
                    <span className="so-ballog-banner__text">
                        Özel mod aktif — Cari ID <strong>{BALLOG_CARI_ID}</strong> otomatik atanıyor, adresler filtrelenmiş havuzdan eşleşiyor.
                    </span>
                </div>
                <Shield size={16} className="so-ballog-banner__icon" />
            </div>
        </div>
    );
}

export default function SiparisOlustur() {
    const [projeAdi, setProjeAdi] = useState("");
    const [rows, setRows] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState("");
    const [lastFile, setLastFile] = useState(null);
    const fileInputRef = useRef(null);

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsError, setProjectsError] = useState("");
    const [overlayLoading, setOverlayLoading] = useState(false);

    // Download progress state
    const [dlPhase, setDlPhase] = useState(null); // null | "template"|"fetch"|"build"|"done"
    const [dlProgress, setDlProgress] = useState(0);

    const columns = useMemo(() => HEADERS, []);

    const [matchModalOpen, setMatchModalOpen] = useState(false);
    const [matchModalTab, setMatchModalTab] = useState("teslim");
    const [matchPreview, setMatchPreview] = useState({
        total: 0, matchedCount: 0, unmatchedCount: 0,
        matchedSamples: [], unmatchedSamples: [],
    });
    const [matchResults, setMatchResults] = useState([]);
    const [matchPreviewYukleme, setMatchPreviewYukleme] = useState({
        total: 0, matchedCount: 0, unmatchedCount: 0,
        matchedSamples: [], unmatchedSamples: [],
    });
    const [matchResultsYukleme, setMatchResultsYukleme] = useState([]);

    const selectedProject = useMemo(
        () => projects.find((p) => p.name === projeAdi),
        [projects, projeAdi]
    );

    const isBallog = projeAdi.trim().toUpperCase() === "BALLOG";

    const filledCellCount = useMemo(
        () => rows.reduce((t, row) => t + columns.filter((c) => normalize(row[c]) !== "").length, 0),
        [rows, columns]
    );

    useEffect(() => {
        const fetchProjects = async () => {
            setProjectsLoading(true);
            setProjectsError("");
            try {
                const { data, error } = await supabase.from("Projeler").select("id, Proje_Adi");
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

    const isExcelFile = (file) =>
        /\.(xlsx|xlsm|xls)$/i.test(file.name) ||
        ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"].includes(file.type);

    const fetchProjectRows = async (projectName) => {
        const { data, error } = await supabase
            .from(DATA_TABLE)
            .select(`${SELECT_COLS}, Proje_Adi`)
            .eq("Proje_Adi", projectName);
        if (error) throw error;
        return Array.isArray(data) ? data : [];
    };

    const applyBallogOverrides = (rowsArr) => {
        if (!isBallog) return rowsArr;
        return rowsArr.map((r) => ({
            ...r,
            ["Alıcı Firma Cari Adı"]: BALLOG_CARI_ID,
        }));
    };

    const applyOverlay = (prevRows, incoming) => {
        const outLen = Math.max(prevRows.length, incoming.length || 0);
        const hasAny = Array.isArray(incoming) && incoming.length > 0;
        return Array.from({ length: outLen }).map((_, i) => {
            const base = prevRows[i] ? { ...prevRows[i] } : emptyRow();
            const rec = hasAny ? incoming[i] ?? incoming[incoming.length - 1] : null;
            if (rec) {
                Object.entries(FIELD_OVERLAY_MAP).forEach(([src, dest]) => {
                    if (src === "proje_id") base[dest] = String(rec.proje_id ?? "");
                    else base[dest] = normalize(rec[src] ?? base[dest]);
                });
            }
            return enrichRow(base);
        });
    };

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
            const headerIndexMap = {};
            HEADERS.forEach((h) => {
                headerIndexMap[h] = rawHeaders.findIndex((x) => normalize(x) === normalize(h));
            });
            const missing = REQUIRED_EXPORT_HEADERS.filter((h) => headerIndexMap[h] === -1);
            if (missing.length) throw new Error(`Eksik başlık: ${missing.join(", ")}. Lütfen şablonu kullanın.`);
            const parsedRows = body
                .filter((row) => row.some((cell) => normalize(cell) !== ""))
                .map((row) => {
                    const obj = {};
                    HEADERS.forEach((h) => { obj[h] = headerIndexMap[h] >= 0 ? normalize(row[headerIndexMap[h]]) : ""; });
                    return enrichRow(obj);
                })
                .map((r) => ({ ...r, Proje: projeAdi || "" }));
            try {
                const incoming = await fetchProjectRows(projeAdi);
                const overlaid = applyOverlay(parsedRows, incoming);
                setRows(applyBallogOverrides(overlaid));
            } catch (er) {
                setRows(applyBallogOverrides(parsedRows));
                setError(er.message || "Proje verileri alınamadı fakat Excel yüklendi.");
            }
            setLastFile(file);
        } catch (e) {
            setRows([]);
            setError(e.message || "Excel okunamadı.");
        }
    };

    const onDrop = (e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) parseExcel(f); };
    const onDragOver = (e) => { e.preventDefault(); setDragActive(true); };
    const onDragLeave = () => setDragActive(false);

    const pickFile = () => {
        if (!projeAdi) { setError("Excel seçmeden önce lütfen bir proje seçin."); return; }
        fileInputRef.current?.click();
    };

    const onFileChange = (e) => {
        const f = e.target.files?.[0];
        if (f) parseExcel(f);
        e.target.value = "";
    };

    const handleTemplateDownload = async () => {
        try {
            setDlPhase("template");
            setDlProgress(5);

            const cols = REQUIRED_EXPORT_HEADERS;
            const wsData = [cols, ...([emptyRow()].map((r) => cols.map((c) => r[c] ?? "")))];
            const wsSablon = XLSX.utils.aoa_to_sheet(wsData);

            setDlProgress(15);
            setDlPhase("fetch");

            let allData = [];
            const pageSize = 1000;
            const { count, error: countError } = await supabase
                .from("Teslim_Noktalari")
                .select("*", { count: "exact", head: true });
            if (countError) throw countError;

            const totalPages = Math.ceil((count || 0) / pageSize);
            for (let page = 0; page < totalPages; page++) {
                const from = page * pageSize;
                const { data, error } = await supabase
                    .from("Teslim_Noktalari")
                    .select("*")
                    .range(from, from + pageSize - 1);
                if (error) throw error;
                allData = allData.concat(data || []);
                const pct = 15 + Math.round(((page + 1) / totalPages) * 60);
                setDlProgress(pct);
            }

            setDlPhase("build");
            setDlProgress(80);

            const docHeaders = allData.length ? Object.keys(allData[0]) : [];
            const wsDokuman = XLSX.utils.json_to_sheet(allData, { header: docHeaders });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, wsSablon, "Sablon");
            XLSX.utils.book_append_sheet(wb, wsDokuman, "DOKÜMAN");

            setDlProgress(95);
            await new Promise((r) => setTimeout(r, 300));

            XLSX.writeFile(wb, `Siparis_Sablon_${new Date().toISOString().slice(0, 10)}.xlsx`);

            setDlProgress(100);
            setDlPhase("done");
        } catch (e) {
            setDlPhase(null);
            setError(e.message || "Şablon indirilirken bir hata oluştu.");
        }
    };

    const handleExportExcel = () => {
        if (!projeAdi) { setError("Dışa aktarmadan önce lütfen bir proje seçin."); return; }
        if (!rows.length) { setError("Dışa aktarılacak veri bulunamadı."); return; }
        const aoa = [columns, ...rows.map((r) => columns.map((c) => r[c] ?? ""))];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tablo");
        XLSX.writeFile(wb, `Siparisler_${projeAdi || "Proje"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const runMatch = (workingRows, sourceCol, candidateList, byAdresAdi) => {
        const key = (s) => String(s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr");
        const SIM_THRESHOLD = 0.78;
        return workingRows.map((row, idx) => {
            const qRaw = row[sourceCol];
            const exact = byAdresAdi.get(key(qRaw));
            if (exact) return { rowIndex: idx, ok: true, before: qRaw, matchedAdresAdi: exact.adres_adi, matchedAdresId: exact.adres_id, matchedCariId: exact.cari_hesap_id, score: 1, suggestions: [] };
            const qClean = cleanAddr(qRaw);
            const suggestions = candidateList
                .map((c) => ({ ...c, _score: scoreSimilarity(qClean, c._clean) }))
                .filter((x) => x._score >= SIM_THRESHOLD)
                .sort((a, b) => b._score - a._score)
                .slice(0, 3)
                .map((s) => ({ adres_adi: s.adres_adi, adres_id: s.adres_id, cari_hesap_id: s.cari_hesap_id, score: Number(s._score.toFixed(2)) }));
            return { rowIndex: idx, ok: false, before: qRaw, score: 0, suggestions };
        });
    };

    const buildPreview = (results, workingRows) => {
        const matched = results.filter((r) => r.ok);
        const unmatched = results.filter((r) => !r.ok);
        return {
            total: workingRows.length,
            matchedCount: matched.length,
            unmatchedCount: unmatched.length,
            matchedSamples: matched.slice(0, 20).map((r) => ({ rowIndex: r.rowIndex, before: r.before, matchedAdresAdi: r.matchedAdresAdi, matchedAdresId: r.matchedAdresId, matchedCariId: r.matchedCariId })),
            unmatchedSamples: unmatched.slice(0, 20).map((r) => ({ rowIndex: r.rowIndex, before: r.before || "—", suggestions: r.suggestions || [] })),
        };
    };

    const handleEslesmeYap = async () => {
        try {
            if (!projeAdi) { setError("Eşleşme yapmadan önce lütfen bir proje seçin."); return; }
            if (!rows.length) { setError("Eşleşme yapmadan önce lütfen Excel yükleyin."); return; }
            setError("");
            setOverlayLoading(true);
            let workingRows = rows;
            try {
                const incoming = await fetchProjectRows(projeAdi);
                if (incoming?.length) {
                    const overlaid = applyOverlay(rows, incoming);
                    workingRows = applyBallogOverrides(overlaid);
                    setRows(workingRows);
                }
            } catch (_) { }

            const pageSize = 1000;
            let countQuery = supabase.from("Teslim_Noktalari").select("*", { count: "exact", head: true });
            if (isBallog) countQuery = countQuery.eq("cari_hesap_id", BALLOG_CARI_ID);
            const { count, error: countError } = await countQuery;
            if (countError) throw countError;

            const totalPages = Math.ceil((count || 0) / pageSize);
            let allAdresler = [];
            for (let page = 0; page < totalPages; page++) {
                const from = page * pageSize;
                let q = supabase.from("Teslim_Noktalari").select("adres_id, adres_adi, cari_hesap_id").range(from, from + pageSize - 1);
                if (isBallog) q = q.eq("cari_hesap_id", BALLOG_CARI_ID);
                const { data, error } = await q;
                if (error) throw error;
                allAdresler = allAdresler.concat(data || []);
            }

            const keyFn = (s) => String(s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr");
            const byAdresAdi = new Map();
            const candidateList = allAdresler.map((a) => {
                const item = { adres_id: a?.adres_id ?? "", adres_adi: a?.adres_adi ?? "", cari_hesap_id: a?.cari_hesap_id ?? "" };
                byAdresAdi.set(keyFn(item.adres_adi), item);
                return { ...item, _clean: cleanAddr(item.adres_adi) };
            });

            const teslimResults = runMatch(workingRows, "Teslim Firma Adres Adı", candidateList, byAdresAdi);
            setMatchResults(teslimResults);
            setMatchPreview(buildPreview(teslimResults, workingRows));

            if (isBallog) {
                const yuklemeResults = runMatch(workingRows, "Yükleme Firması Adı", candidateList, byAdresAdi);
                setMatchResultsYukleme(yuklemeResults);
                setMatchPreviewYukleme(buildPreview(yuklemeResults, workingRows));
                setMatchModalTab("teslim");
            } else {
                setMatchResultsYukleme([]);
                setMatchPreviewYukleme({ total: 0, matchedCount: 0, unmatchedCount: 0, matchedSamples: [], unmatchedSamples: [] });
            }

            setMatchModalOpen(true);
        } catch (e) {
            setError(e.message || "Eşleşme sırasında hata oluştu.");
        } finally {
            setOverlayLoading(false);
        }
    };

    const confirmApplyMatches = () => {
        setRows((prev) => {
            const teslimByIndex = new Map(matchResults.filter((r) => r.ok).map((r) => [r.rowIndex, r]));
            const yuklemeByIndex = new Map(matchResultsYukleme.filter((r) => r.ok).map((r) => [r.rowIndex, r]));

            return prev.map((row, i) => {
                const yeniRow = { ...row };
                const teslim = teslimByIndex.get(i);
                if (teslim) {
                    yeniRow["Teslim Firma Adres Adı"] = String(teslim.matchedAdresId ?? "");
                    yeniRow["Alıcı Firma Cari Adı"] = isBallog ? BALLOG_CARI_ID : String(teslim.matchedCariId ?? "");
                }
                if (isBallog) {
                    const yukleme = yuklemeByIndex.get(i);
                    if (yukleme) yeniRow["Yükleme Firması Adı"] = String(yukleme.matchedAdresId ?? "");
                    yeniRow["Alıcı Firma Cari Adı"] = BALLOG_CARI_ID;
                }
                return yeniRow;
            });
        });
        setMatchModalOpen(false);
    };

    const handleTemizle = () => {
        setRows([]); setLastFile(null); setError("");
        setMatchResults([]);
        setMatchPreview({ total: 0, matchedCount: 0, unmatchedCount: 0, matchedSamples: [], unmatchedSamples: [] });
        setMatchModalOpen(false);
    };

    /* ── Match panel renderer ── */
    const renderMatchPanel = (preview, label) => (
        <div className="so-modal__grid">
            <div className="so-match-panel">
                <div className="so-match-panel__head">
                    <span className="so-match-panel__label">
                        <CheckCircle2 size={15} color="var(--c-green)" />
                        Eşleşenler
                    </span>
                    <span className="so-badge so-badge--good">{preview.matchedCount}</span>
                </div>
                {preview.matchedSamples?.length ? (
                    <ul className="so-match-list">
                        {preview.matchedSamples.map((s) => (
                            <li key={`m-${s.rowIndex}-${label}`} className="so-match-item">
                                <div className="so-match-row">
                                    <div className="so-match-col">
                                        <span className="so-match-col__label">Bizim Adres</span>
                                        <div className="so-addr">{s.before}</div>
                                    </div>
                                    <div className="so-arrow">→</div>
                                    <div className="so-match-col">
                                        <span className="so-match-col__label">Sistemdeki</span>
                                        <div className="so-addr so-addr--good">{s.matchedAdresAdi}</div>
                                    </div>
                                </div>
                                <div className="so-match-meta">
                                    <span className="so-tag">adres_id: {s.matchedAdresId}</span>
                                    <span className="so-tag">cari_id: {s.matchedCariId}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : <div className="so-empty-state">Eşleşen kayıt yok.</div>}
            </div>

            <div className="so-match-panel">
                <div className="so-match-panel__head">
                    <span className="so-match-panel__label">
                        <XCircle size={15} color="var(--c-red)" />
                        Eşleşmeyenler
                    </span>
                    <span className="so-badge so-badge--bad">{preview.unmatchedCount}</span>
                </div>
                {preview.unmatchedSamples?.length ? (
                    <ul className="so-match-list">
                        {preview.unmatchedSamples.map((s) => (
                            <li key={`u-${s.rowIndex}-${label}`} className="so-match-item">
                                <div className="so-match-row">
                                    <div className="so-match-col">
                                        <span className="so-match-col__label">Bizim Adres</span>
                                        <div className="so-addr">{s.before}</div>
                                    </div>
                                    <div className="so-arrow">→</div>
                                    <div className="so-match-col">
                                        <span className="so-match-col__label">Sistemde</span>
                                        <div className="so-addr so-addr--bad">Bulunamadı</div>
                                    </div>
                                </div>
                                {!!s.suggestions?.length && (
                                    <div className="so-suggestions">
                                        {s.suggestions.map((sg, i) => (
                                            <span key={i} className="so-suggestion">
                                                {sg.adres_adi} · %{Math.round(sg.score * 100)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : <div className="so-empty-state">Hepsi eşleşti 🎉</div>}
            </div>
        </div>
    );

    return (
        <div className={`so-page${isBallog ? " so-page--ballog" : ""}`}>
            {/* Download progress modal */}
            {dlPhase && (
                <DownloadProgressModal
                    phase={dlPhase}
                    progress={dlProgress}
                    onClose={() => { setDlPhase(null); setDlProgress(0); }}
                />
            )}

            <div className="so-inner">
                {/* ── Header ── */}
                <header className="so-header">
                    <div className="so-header__left">
                        <div className={`so-logo-box${isBallog ? " so-logo-box--ballog" : ""}`}>
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <div className="so-header__title">Sipariş Oluştur</div>
                            <div className="so-header__sub">Excel yükle · eşleştir · aktar</div>
                        </div>
                    </div>
                    <div className="so-header__stats">
                        <div className="so-stat-pill">
                            <FolderKanban size={14} />
                            <strong>{projects.length}</strong>
                            <span>proje</span>
                        </div>
                        <div className="so-stat-pill">
                            <ListChecks size={14} />
                            <strong>{rows.length}</strong>
                            <span>satır</span>
                        </div>
                        <div className="so-stat-pill">
                            <CheckCircle2 size={14} />
                            <strong>{filledCellCount}</strong>
                            <span>dolu hücre</span>
                        </div>
                    </div>
                </header>

                {/* ── BALLOG Banner ── */}
                {isBallog && <BallogBanner />}

                {/* ── Controls ── */}
                <div className="so-controls">
                    <div className="so-project-row">
                        <div className="so-field">
                            <label className="so-label">Proje Seçimi</label>
                            <select
                                className={`so-select${isBallog ? " so-select--ballog" : ""}`}
                                value={projeAdi}
                                onChange={(e) => setProjeAdi(e.target.value)}
                                disabled={projectsLoading}
                            >
                                <option value="">— Proje seçiniz —</option>
                                {projectsLoading && <option disabled>Yükleniyor...</option>}
                                {!projectsLoading && projectsError && <option disabled>Hata: {projectsError}</option>}
                                {!projectsLoading && !projectsError && projects.map((p) => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        {selectedProject ? (
                            <div className={`so-project-badge so-project-badge--ok${isBallog ? " so-project-badge--ballog" : ""}`}>
                                <CheckCircle2 size={14} />
                                {selectedProject.name}
                            </div>
                        ) : (
                            <div className="so-project-badge so-project-badge--empty">Seçilmedi</div>
                        )}
                    </div>

                    <div className="so-action-group">
                        <button className="so-btn so-btn--primary" onClick={handleTemplateDownload} title="Şablonu indir">
                            <Download size={15} />
                            Şablon İndir
                        </button>
                        <button
                            className={`so-btn${isBallog ? " so-btn--ballog" : ""}`}
                            onClick={handleEslesmeYap}
                            disabled={!projeAdi || overlayLoading || !rows.length}
                            title="Adres eşleştir"
                        >
                            <LinkIcon size={15} />
                            {overlayLoading ? "Eşleştiriliyor..." : "Eşleştir"}
                        </button>
                        <button
                            className="so-btn"
                            onClick={handleExportExcel}
                            disabled={!rows.length || !projeAdi}
                            title="Excel olarak aktar"
                        >
                            <FileSpreadsheet size={15} />
                            Excel Aktar
                        </button>
                        <button
                            className="so-btn so-btn--danger"
                            onClick={handleTemizle}
                            disabled={!rows.length && !lastFile && !error}
                            title="Temizle"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>

                {/* ── Alerts ── */}
                {(error || lastFile) && (
                    <div className="so-alerts">
                        {error && (
                            <div className="so-alert so-alert--error">
                                <XCircle size={15} />{error}
                            </div>
                        )}
                        {lastFile && (
                            <div className="so-alert so-alert--success">
                                <CheckCircle2 size={15} />
                                Yüklü dosya: <strong>{lastFile.name}</strong>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Table card ── */}
                <div className="so-table-card">
                    <div className="so-table-top">
                        <div className="so-table-top__left">
                            <ListChecks size={16} />
                            Sipariş Şablonu
                        </div>
                        <div className="so-table-top__right">
                            {rows.length > 0 && <span className="so-table-meta">{rows.length} satır</span>}
                        </div>
                    </div>

                    <div className="so-table-wrap">
                        <table className="so-table">
                            <thead>
                                <tr>
                                    <th className="so-th-index">#</th>
                                    {columns.map((c) => <th key={c}>{c}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr className="so-drop-row">
                                        <td colSpan={columns.length + 1}>
                                            <div
                                                className={`so-drop-zone${dragActive ? " active" : ""}${!projeAdi ? " disabled" : ""}${isBallog ? " so-drop-zone--ballog" : ""}`}
                                                onDrop={onDrop}
                                                onDragOver={onDragOver}
                                                onDragLeave={onDragLeave}
                                                onDragEnd={onDragLeave}
                                                onClick={pickFile}
                                                role="button"
                                                tabIndex={0}
                                                aria-label="Excel sürükleyip bırak veya tıkla"
                                            >
                                                <div className={`so-drop-icon${isBallog ? " so-drop-icon--ballog" : ""}`}>
                                                    <UploadCloud size={26} />
                                                </div>
                                                <div className="so-drop-title">Excel dosyanı buraya sürükle</div>
                                                <div className="so-drop-sub">veya <strong>tıklayarak seç</strong> (.xlsx / .xls)</div>
                                                {!projeAdi && (
                                                    <div className="so-drop-warn">
                                                        <AlertTriangle size={13} />
                                                        Önce proje seçmelisiniz
                                                    </div>
                                                )}
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
                                        <tr key={rowIdx} className="so-table-row-animate" style={{ animationDelay: `${Math.min(rowIdx * 18, 400)}ms` }}>
                                            <td className="so-td-index">{rowIdx + 1}</td>
                                            {columns.map((col) => (
                                                <td key={`${rowIdx}-${col}`} title={row[col] || ""}>
                                                    <div className="so-cell">{row[col] || "—"}</div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="so-table-footer">
                        İpucu: Önce "Şablon İndir" ile doğru başlıkları alın, doldurun ve buraya yükleyin. Tablo yatay kaydırılabilir; sıra numarası ve başlıklar sabittir.
                    </div>
                </div>
            </div>

            {/* ── Match Modal ── */}
            {matchModalOpen && (
                <div className="so-backdrop" role="dialog" aria-modal="true">
                    <div className={`so-modal${isBallog ? " so-modal--ballog" : ""}`}>
                        <div className="so-modal__head">
                            <div>
                                <div className="so-modal__title">Adres Eşleşme Özeti</div>
                                <div className="so-modal__desc">Eşleşen kayıtlar onay sonrası tabloya uygulanır.</div>
                            </div>
                            <div className="so-kpis">
                                <span className="so-kpi so-kpi--neutral">Toplam <strong>{matchPreview.total}</strong></span>
                                <span className="so-kpi so-kpi--good"><CheckCircle2 size={13} /> <strong>{matchPreview.matchedCount}</strong> eşleşti</span>
                                <span className="so-kpi so-kpi--bad"><XCircle size={13} /> <strong>{matchPreview.unmatchedCount}</strong> eşleşmedi</span>
                            </div>
                        </div>

                        {isBallog && (
                            <div className="so-modal__tabs">
                                <button
                                    className={`so-tab${matchModalTab === "teslim" ? " so-tab--active" : ""}`}
                                    onClick={() => setMatchModalTab("teslim")}
                                >
                                    Teslim Firma
                                </button>
                                <button
                                    className={`so-tab${matchModalTab === "yukleme" ? " so-tab--active" : ""}`}
                                    onClick={() => setMatchModalTab("yukleme")}
                                >
                                    Yükleme Firması
                                </button>
                            </div>
                        )}

                        <div className="so-modal__body">
                            {(!isBallog || matchModalTab === "teslim") && renderMatchPanel(matchPreview, "teslim")}
                            {isBallog && matchModalTab === "yukleme" && renderMatchPanel(matchPreviewYukleme, "yukleme")}
                        </div>

                        <div className="so-modal__foot">
                            <button className="so-btn" onClick={() => setMatchModalOpen(false)}>Vazgeç</button>
                            <button className={`so-btn so-btn--primary${isBallog ? " so-btn--ballog-confirm" : ""}`} onClick={confirmApplyMatches}>
                                <CheckCircle2 size={15} />
                                Onayla ve Uygula
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}