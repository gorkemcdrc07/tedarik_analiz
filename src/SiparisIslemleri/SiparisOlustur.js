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
    LoaderCircle,
    ChevronDown,
    FileCheck2,
    ArrowRight,
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
const BALLOG_TABLE = "ballog_teslim_noktalari";
const BALLOG_CARI_COLUMN = "cari_hesap_id";

const DETAIL_FIELD_KEYS = {
    cariUnvani: ["cari_unvani", "cari_unvan", "Cari_Unvani", "Cari_Unvan", "CariUnvani", "Cari Adı", "cari_adi", "unvan", "firma_unvani"],
    vkn: ["vkn", "Vkn", "VKN", "vergi_no", "vergi_numarasi", "Vergi_No", "Vergi Numarası"],
    il: ["il", "Il", "İl", "sehir", "şehir", "Sehir", "Şehir"],
    ilce: ["ilce", "ilçe", "Ilce", "İlçe"],
    mahalle: ["mahalle", "Mahalle", "mah"],
    adres: ["adres", "Adres", "tam_adres", "Tam_Adres", "adres_detay", "Adres_Detay", "acik_adres"],
    telefon: ["telefon", "Telefon", "tel", "gsm", "GSM"],
    email: ["email", "e_mail", "Eposta", "E-Posta", "mail"],
};

const pickFirst = (obj, keys, fallback = "") => {
    for (const key of keys) {
        const val = obj?.[key];
        if (val !== undefined && val !== null && String(val).trim() !== "") return normalize(val);
    }
    return fallback;
};

const buildCandidateDetails = (raw = {}) => ({
    adres_id: normalize(raw?.adres_id ?? raw?.id ?? ""),
    adres_adi: normalize(raw?.adres_adi ?? raw?.["Adres Adı"] ?? raw?.["adres adı"] ?? ""),
    cari_hesap_id: normalize(raw?.cari_hesap_id ?? raw?.[BALLOG_CARI_COLUMN] ?? raw?.["cari hesap id"] ?? ""),
    cari_unvani: pickFirst(raw, DETAIL_FIELD_KEYS.cariUnvani),
    vkn: pickFirst(raw, DETAIL_FIELD_KEYS.vkn),
    il: pickFirst(raw, DETAIL_FIELD_KEYS.il),
    ilce: pickFirst(raw, DETAIL_FIELD_KEYS.ilce),
    mahalle: pickFirst(raw, DETAIL_FIELD_KEYS.mahalle),
    adres: pickFirst(raw, DETAIL_FIELD_KEYS.adres),
    telefon: pickFirst(raw, DETAIL_FIELD_KEYS.telefon),
    email: pickFirst(raw, DETAIL_FIELD_KEYS.email),
});

const detailRows = (item = {}) => [
    ["Adres ID", item.adres_id],
    ["Cari Hesap ID", item.cari_hesap_id],
    ["Cari Ünvan", item.cari_unvani],
    ["VKN", item.vkn],
    ["İl", item.il],
    ["İlçe", item.ilce],
    ["Mahalle", item.mahalle],
    ["Tam Adres", item.adres],
    ["Telefon", item.telefon],
    ["E-posta", item.email],
].filter(([, value]) => normalize(value) !== "");

const emptyRow = () => HEADERS.reduce((acc, key) => ({ ...acc, [key]: "" }), {});
const sortTr = (a, b) => String(a).localeCompare(String(b), "tr", { sensitivity: "base" });
const normalize = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const normalizeHeader = (s) =>
    String(s ?? "")
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase("tr");
const normalizeKey = (s) => normalize(s).toLocaleUpperCase("tr");

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

const foldTr = (s) =>
    String(s ?? "")
        .replace(/İ/g, "i")
        .replace(/I/g, "i")
        .replace(/ı/g, "i")
        .replace(/Ğ/g, "g")
        .replace(/ğ/g, "g")
        .replace(/Ü/g, "u")
        .replace(/ü/g, "u")
        .replace(/Ş/g, "s")
        .replace(/ş/g, "s")
        .replace(/Ö/g, "o")
        .replace(/ö/g, "o")
        .replace(/Ç/g, "c")
        .replace(/ç/g, "c")
        .toLowerCase();

const cleanAddr = (s) =>
    foldTr(s)
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const compactAddr = (s) => cleanAddr(s).replace(/\s+/g, "");

const addrTokens = (s) =>
    cleanAddr(s)
        .split(" ")
        .map((x) => x.trim())
        .filter(Boolean);

const bigrams = (str) => {
    const s = compactAddr(str);
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

const tokenSimilarity = (a, b) => {
    const A = new Set(addrTokens(a));
    const B = new Set(addrTokens(b));
    if (!A.size || !B.size) return 0;
    let inter = 0;
    A.forEach((t) => { if (B.has(t)) inter++; });
    return inter / Math.max(A.size, B.size);
};

const scoreSimilarity = (q, cand) => {
    const a = cleanAddr(q);
    const b = cleanAddr(cand);
    if (!a || !b) return 0;
    if (a === b) return 1;

    const ac = compactAddr(a);
    const bc = compactAddr(b);
    if (ac === bc) return 0.99;
    if (ac.includes(bc) || bc.includes(ac)) return 0.96;

    const dice = diceCoefficient(a, b);
    const token = tokenSimilarity(a, b);
    return Math.max(dice, token);
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
                        Özel mod aktif — Cari ID <strong>{BALLOG_CARI_ID}</strong> otomatik atanıyor, adresler BALLOG teslim noktası tablosundan eşleşiyor.
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
    const ballogFileInputRef = useRef(null);

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsError, setProjectsError] = useState("");
    const [overlayLoading, setOverlayLoading] = useState(false);
    const [ballogImporting, setBallogImporting] = useState(false);
    const [ballogImportResult, setBallogImportResult] = useState(null);
    const [uploadStage, setUploadStage] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

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
    const [editingMatchedKey, setEditingMatchedKey] = useState(null);

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
        setIsUploading(true);
        setUploadProgress(8);
        setUploadStage("Dosya okunuyor");
        try {
            if (!projeAdi) throw new Error("Excel yüklemeden önce lütfen bir proje seçin.");
            if (!isExcelFile(file)) throw new Error("Lütfen .xlsx / .xls dosyası yükleyin.");

            const buf = await file.arrayBuffer();
            setUploadProgress(34);
            setUploadStage("Excel yapısı analiz ediliyor");
            await new Promise((r) => setTimeout(r, 90));

            const wb = XLSX.read(buf, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
            if (!aoa || aoa.length === 0) throw new Error("Boş sayfa görünüyor.");

            setUploadProgress(56);
            setUploadStage("Başlıklar doğrulanıyor");
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

            setUploadProgress(76);
            setUploadStage("Proje verileri uygulanıyor");
            try {
                const incoming = await fetchProjectRows(projeAdi);
                const overlaid = applyOverlay(parsedRows, incoming);
                setRows(applyBallogOverrides(overlaid));
            } catch (er) {
                setRows(applyBallogOverrides(parsedRows));
                setError(er.message || "Proje verileri alınamadı fakat Excel yüklendi.");
            }

            setLastFile(file);
            setUploadProgress(100);
            setUploadStage("Dosya hazır");
            await new Promise((r) => setTimeout(r, 420));
        } catch (e) {
            setRows([]);
            setUploadStage("Yükleme başarısız");
            setError(e.message || "Excel okunamadı.");
            await new Promise((r) => setTimeout(r, 260));
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            setUploadStage("");
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
        const key = (x) => compactAddr(String(x ?? "").replace(/ /g, " "));
        const SIM_THRESHOLD = 0.32;
        const MAX_SUGGESTIONS = 50;

        const mapSuggestion = (s) => ({
            adres_adi: s.adres_adi,
            adres_id: s.adres_id,
            cari_hesap_id: s.cari_hesap_id,
            cari_unvani: s.cari_unvani,
            vkn: s.vkn,
            il: s.il,
            ilce: s.ilce,
            mahalle: s.mahalle,
            adres: s.adres,
            telefon: s.telefon,
            email: s.email,
            score: Number((s._score ?? s.score ?? 0).toFixed(2)),
        });

        const getSuggestions = (qClean, excludeAdresId = "") => {
            const allSuggestions = candidateList
                .map((c) => {
                    const adresScore = scoreSimilarity(qClean, c._clean);
                    const cariScore = scoreSimilarity(qClean, c._cariClean);
                    const ilScore = scoreSimilarity(qClean, c._ilClean);
                    const ilceScore = scoreSimilarity(qClean, c._ilceClean);
                    const fullScore = Math.max(
                        adresScore,
                        (adresScore * 0.7) + (cariScore * 0.2) + (ilScore * 0.05) + (ilceScore * 0.05)
                    );
                    return { ...c, _score: fullScore };
                })
                .filter((x) => x._score >= SIM_THRESHOLD)
                .filter((x) => String(x.adres_id ?? "") !== String(excludeAdresId ?? ""))
                .sort((a, b) => b._score - a._score);

            return {
                total: allSuggestions.length,
                items: allSuggestions.slice(0, MAX_SUGGESTIONS).map(mapSuggestion),
            };
        };

        return workingRows.map((row, idx) => {
            const qRaw = row[sourceCol];
            const qClean = cleanAddr(qRaw);
            const exact = byAdresAdi.get(key(qRaw));

            if (exact) {
                const suggestionPack = getSuggestions(qClean, exact.adres_id);
                return {
                    rowIndex: idx,
                    ok: true,
                    before: qRaw,
                    matchedAdresAdi: exact.adres_adi,
                    matchedAdresId: exact.adres_id,
                    matchedCariId: exact.cari_hesap_id,
                    matchedDetail: exact,
                    score: 1,
                    suggestionTotal: suggestionPack.total,
                    suggestions: suggestionPack.items,
                };
            }

            const suggestionPack = getSuggestions(qClean);
            return {
                rowIndex: idx,
                ok: false,
                before: qRaw,
                score: 0,
                suggestionTotal: suggestionPack.total,
                suggestions: suggestionPack.items,
            };
        });
    };

    const buildPreview = (results, workingRows) => {
        const matched = results.filter((r) => r.ok);
        const unmatched = results.filter((r) => !r.ok);
        return {
            total: workingRows.length,
            matchedCount: matched.length,
            unmatchedCount: unmatched.length,
            matchedSamples: matched.map((r) => ({
                rowIndex: r.rowIndex,
                before: r.before,
                matchedAdresAdi: r.matchedAdresAdi,
                matchedAdresId: r.matchedAdresId,
                matchedCariId: r.matchedCariId,
                matchedDetail: r.matchedDetail,
                manual: !!r.manual,
                suggestionTotal: r.suggestionTotal || 0,
                suggestions: r.suggestions || [],
            })),
            unmatchedSamples: unmatched.map((r) => ({
                rowIndex: r.rowIndex,
                before: r.before || "—",
                suggestionTotal: r.suggestionTotal || 0,
                suggestions: r.suggestions || [],
            })),
        };
    };

    const handleSuggestionSelect = (label, rowIndex, suggestion) => {
        const applySelection = (results) => results.map((r) => {
            if (r.rowIndex !== rowIndex) return r;
            return {
                ...r,
                ok: true,
                manual: true,
                matchedAdresAdi: suggestion.adres_adi,
                matchedAdresId: suggestion.adres_id,
                matchedCariId: suggestion.cari_hesap_id,
                matchedDetail: suggestion,
                score: suggestion.score,
                suggestions: r.suggestions || [],
            };
        });

        setEditingMatchedKey(null);

        if (label === "yukleme") {
            setMatchResultsYukleme((prev) => {
                const updated = applySelection(prev);
                setMatchPreviewYukleme(buildPreview(updated, rows));
                return updated;
            });
            return;
        }

        setMatchResults((prev) => {
            const updated = applySelection(prev);
            setMatchPreview(buildPreview(updated, rows));
            return updated;
        });
    };

    const getAdresSelectCols = () => "*";

    const pickBallogFile = () => {
        if (!isBallog) {
            setError("Teslim noktası eklemek için BALLOG projesini seçmelisiniz.");
            return;
        }
        ballogFileInputRef.current?.click();
    };

    const parseBallogDeliveryFile = async (file) => {
        if (!isExcelFile(file)) throw new Error("Lütfen .xlsx / .xls dosyası yükleyin.");

        const normalizeExcelHeader = (s) =>
            String(s ?? "")
                .replace(/\u00A0/g, " ")
                .replace(/\ufeff/g, "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase()
                .replace(/ı/g, "i")
                .replace(/İ/g, "i");

        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: false });

        let aoa = [];
        let usedSheetName = "";

        for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, {
                header: 1,
                defval: "",
                blankrows: false,
                raw: false,
            });

            if (rows?.length) {
                aoa = rows;
                usedSheetName = sheetName;
                break;
            }
        }

        if (!aoa || aoa.length === 0) {
            throw new Error("Yüklenen dosya boş görünüyor.");
        }

        let headerRowIndex = -1;
        let headerMap = {};

        for (let i = 0; i < Math.min(20, aoa.length); i++) {
            const map = {};
            aoa[i].forEach((h, index) => {
                const key = normalizeExcelHeader(h);
                if (key) map[key] = index;
            });

            console.log("HEADER MAP =>", map);

            const hasAdres = map["adres adı"] !== undefined || map["adres adi"] !== undefined;
            const hasCari = map["cari hesap id"] !== undefined;
            const hasId = map["id"] !== undefined;

            console.log({
                hasAdres,
                hasCari,
                hasId
            });

            if (hasAdres && hasCari && hasId) {
                headerRowIndex = i;
                headerMap = map;
                break;
            }
        }

        if (headerRowIndex === -1) {
            const detectedHeaders = aoa[0].map((x) => `"${String(x ?? "").trim()}"`).join(", ");

            throw new Error(
                `BALLOG başlık satırı bulunamadı. Okunan ilk satır: ${detectedHeaders}`
            );
        }

        const adresIdx =
            headerMap["adres adı"] ??
            headerMap["adres adi"];

        const cariIdx = headerMap["cari hesap id"];

        const idIdx = headerMap["id"];
        const body = aoa.slice(headerRowIndex + 1);

        const unique = new Map();

        body.forEach((row) => {
            const adresId = normalize(row[idIdx]);
            const adresAdi = normalize(row[adresIdx]);
            const cariHesap = normalize(row[cariIdx]) || BALLOG_CARI_ID;

            if (!adresId || !adresAdi) return;

            const key = normalizeKey(adresId);

            if (!unique.has(key)) {
                unique.set(key, {
                    adres_id: adresId,
                    adres_adi: adresAdi,
                    [BALLOG_CARI_COLUMN]: cariHesap,
                });
            }
        });

        const parsed = Array.from(unique.values());

        if (!parsed.length) {
            throw new Error("Dosyada eklenecek teslim noktası bulunamadı.");
        }

        console.log("BALLOG kullanılan sayfa:", usedSheetName);
        console.log("BALLOG başlık satırı:", headerRowIndex + 1);
        console.log("BALLOG okunan başlıklar:", headerMap);
        console.log("BALLOG parsed:", parsed);

        return parsed;
    };

    const handleBallogTeslimNoktasiImport = async (file) => {
        setError("");
        setBallogImportResult(null);
        setBallogImporting(true);

        try {
            const parsedRows = await parseBallogDeliveryFile(file);
            const pageSize = 1000;

            const { count, error: countError } = await supabase
                .from(BALLOG_TABLE)
                .select("adres_id, adres_adi", { count: "exact", head: true });
            if (countError) throw countError;

            const totalPages = Math.ceil((count || 0) / pageSize);
            let existingRows = [];

            for (let page = 0; page < totalPages; page++) {
                const from = page * pageSize;
                const { data, error } = await supabase
                    .from(BALLOG_TABLE)
                    .select("adres_id, adres_adi")
                    .range(from, from + pageSize - 1);
                if (error) throw error;
                existingRows = existingRows.concat(data || []);
            }

            const existingIds = new Set(existingRows.map((r) => normalizeKey(r?.adres_id)));
            const existingNames = new Set(existingRows.map((r) => normalizeKey(r?.adres_adi)));

            const rowsToInsert = parsedRows.filter((r) => {
                const idKey = normalizeKey(r.adres_id);
                const nameKey = normalizeKey(r.adres_adi);
                return !existingIds.has(idKey) && !existingNames.has(nameKey);
            });

            if (!rowsToInsert.length) {
                setBallogImportResult({ total: parsedRows.length, inserted: 0, skipped: parsedRows.length });
                return;
            }

            const insertChunkSize = 500;
            for (let i = 0; i < rowsToInsert.length; i += insertChunkSize) {
                const chunk = rowsToInsert.slice(i, i + insertChunkSize);
                const { error } = await supabase.from(BALLOG_TABLE).insert(chunk);
                if (error) throw error;
            }

            setBallogImportResult({
                total: parsedRows.length,
                inserted: rowsToInsert.length,
                skipped: parsedRows.length - rowsToInsert.length,
            });
        } catch (e) {
            setError(e.message || "BALLOG teslim noktaları eklenirken hata oluştu.");
        } finally {
            setBallogImporting(false);
        }
    };

    const onBallogFileChange = (e) => {
        const f = e.target.files?.[0];
        if (f) handleBallogTeslimNoktasiImport(f);
        e.target.value = "";
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
            const adresTableName = isBallog ? BALLOG_TABLE : "Teslim_Noktalari";

            const { count, error: countError } = await supabase
                .from(adresTableName)
                .select("*", { count: "exact", head: true });

            if (countError) throw countError;

            const totalPages = Math.ceil((count || 0) / pageSize);
            let allAdresler = [];

            for (let page = 0; page < totalPages; page++) {
                const from = page * pageSize;

                const { data, error } = await supabase
                    .from(adresTableName)
                    .select(getAdresSelectCols())
                    .range(from, from + pageSize - 1);

                if (error) throw error;

                allAdresler = allAdresler.concat(data || []);
            }

            const keyFn = (s) => compactAddr(String(s ?? "").replace(/\u00A0/g, " "));
            const byAdresAdi = new Map();
            const candidateList = allAdresler.map((a) => {
                const item = buildCandidateDetails(a);
                byAdresAdi.set(keyFn(item.adres_adi), item);
                return {
                    ...item,
                    _clean: cleanAddr(item.adres_adi),
                    _cariClean: cleanAddr(item.cari_unvani),
                    _ilClean: cleanAddr(item.il),
                    _ilceClean: cleanAddr(item.ilce),
                };
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

            setEditingMatchedKey(null);
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
        setEditingMatchedKey(null);
    };

    const handleTemizle = () => {
        setRows([]); setLastFile(null); setError("");
        setMatchResults([]);
        setMatchPreview({ total: 0, matchedCount: 0, unmatchedCount: 0, matchedSamples: [], unmatchedSamples: [] });
        setBallogImportResult(null);
        setMatchModalOpen(false);
        setEditingMatchedKey(null);
    };

    /* ── Match panel renderer ── */
    const renderDetailGrid = (item) => {
        const rows = detailRows(item);
        if (!rows.length) return null;
        return (
            <div className="so-detail-grid">
                {rows.map(([label, value]) => (
                    <div className="so-detail" key={`${label}-${value}`}>
                        <span>{label}</span>
                        <strong title={value}>{value}</strong>
                    </div>
                ))}
            </div>
        );
    };

    const getMatchContext = (label) => (
        label === "yukleme"
            ? {
                title: "Yükleme Firması Eşleştirmesi",
                sourceLabel: "Excel'deki Yükleme Firması",
                targetLabel: "Sistemdeki Yükleme Noktası",
                sourceField: "Yükleme Firması Adı",
                targetField: "adres_id",
            }
            : {
                title: "Teslim Firması Eşleştirmesi",
                sourceLabel: "Excel'deki Teslim Firması",
                targetLabel: "Sistemdeki Teslim Noktası",
                sourceField: "Teslim Firma Adres Adı",
                targetField: "adres_id / cari_hesap_id",
            }
    );

    const renderSuggestionCard = (s, rowIndex, label, i) => {
        const context = getMatchContext(label);
        const scorePercent = Math.round((s.score || 0) * 100);

        return (
            <button
                key={`${rowIndex}-${label}-${s.adres_id}-${i}`}
                type="button"
                className="so-suggestion-card"
                onClick={() => handleSuggestionSelect(label, rowIndex, s)}
                title={`${s.adres_adi} kaydını seç`}
            >
                <div className="so-suggestion-card__top">
                    <div className="so-suggestion-card__heading">
                        <div className={`so-score-pill ${scorePercent >= 75
                                ? "so-score-pill--high"
                                : scorePercent >= 50
                                    ? "so-score-pill--medium"
                                    : "so-score-pill--low"
                            }`}>
                            %{scorePercent} benzerlik
                        </div>

                        <div className="so-suggestion-caption">
                            {context.targetLabel}
                        </div>

                        <div className="so-suggestion-title">
                            {s.adres_adi || "Adres adı bulunamadı"}
                        </div>
                    </div>

                    <span className="so-use-badge">
                        <CheckCircle2 size={13} />
                        Bu kaydı kullan
                    </span>
                </div>

                <div className="so-suggestion-primary-info">
                    <div>
                        <span>Adres ID</span>
                        <strong>{s.adres_id || "—"}</strong>
                    </div>
                    <div>
                        <span>Cari Hesap ID</span>
                        <strong>{s.cari_hesap_id || "—"}</strong>
                    </div>
                </div>

                {renderDetailGrid(s)}
            </button>
        );
    };

    const renderMatchPanel = (preview, label) => {
        const context = getMatchContext(label);

        return (
            <div className="so-match-workspace">
                <div className="so-match-context-banner">
                    <div>
                        <span className="so-match-context-banner__eyebrow">Aktif eşleştirme alanı</span>
                        <strong>{context.title}</strong>
                        <p>
                            Excel sütunu: <b>{context.sourceField}</b> · Sisteme yazılacak alan:
                            <b> {context.targetField}</b>
                        </p>
                    </div>
                    <div className="so-match-context-banner__count">
                        <span>İncelenen satır</span>
                        <strong>{preview.total}</strong>
                    </div>
                </div>

                <div className="so-modal__grid so-modal__grid--modern">
                    <div className="so-match-panel so-match-panel--success">
                        <div className="so-match-panel__head">
                            <div>
                                <span className="so-match-panel__label">
                                    <CheckCircle2 size={16} color="var(--c-green)" />
                                    Doğrudan Eşleşen Kayıtlar
                                </span>
                                <small>Excel değeri sistemde birebir bulundu.</small>
                            </div>
                            <span className="so-badge so-badge--good">{preview.matchedCount}</span>
                        </div>

                        {preview.matchedSamples?.length ? (
                            <ul className="so-match-list so-match-list--cards">
                                {preview.matchedSamples.map((s) => {
                                    const editKey = `${label}-${s.rowIndex}`;
                                    const isEditing = editingMatchedKey === editKey;

                                    return (
                                        <li key={`m-${s.rowIndex}-${label}`} className="so-match-item so-match-item--modern">
                                            <div className="so-record-index">Excel satırı #{s.rowIndex + 2}</div>

                                            <div className="so-match-row">
                                                <div className="so-match-col so-match-col--source">
                                                    <span className="so-match-col__label">{context.sourceLabel}</span>
                                                    <div className="so-addr so-addr--source">{s.before}</div>
                                                </div>

                                                <div className="so-arrow" aria-hidden="true">→</div>

                                                <div className="so-match-col so-match-col--target">
                                                    <span className="so-match-col__label">{context.targetLabel}</span>
                                                    <div className="so-addr so-addr--good">{s.matchedAdresAdi}</div>
                                                </div>
                                            </div>

                                            <div className="so-selected-record-title">
                                                <span>Seçilen sistem kaydının detayları</span>
                                                <strong>{s.manual ? "Manuel seçim" : "Birebir eşleşme"}</strong>
                                            </div>

                                            {renderDetailGrid(s.matchedDetail || {
                                                adres_id: s.matchedAdresId,
                                                cari_hesap_id: s.matchedCariId,
                                            })}

                                            <div className="so-match-actions">
                                                {s.manual && (
                                                    <div className="so-manual-note">
                                                        <CheckCircle2 size={14} />
                                                        Manuel seçim uygulandı
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    className="so-change-match-btn"
                                                    onClick={() => setEditingMatchedKey(isEditing ? null : editKey)}
                                                    disabled={!s.suggestions?.length}
                                                    title={
                                                        s.suggestions?.length
                                                            ? "Alternatif yakın kayıtları göster"
                                                            : "Alternatif yakın eşleşme bulunamadı"
                                                    }
                                                >
                                                    {isEditing
                                                        ? "Alternatifleri kapat"
                                                        : `Alternatifleri göster (${s.suggestionTotal || s.suggestions?.length || 0})`}
                                                </button>
                                            </div>

                                            {isEditing && (
                                                !!s.suggestions?.length ? (
                                                    <div className="so-alternative-area">
                                                        <div className="so-alternative-area__head">
                                                            <div>
                                                                <strong>Yakın sistem kayıtları</strong>
                                                                <span>
                                                                    Benzerliğe göre sıralandı. En fazla {s.suggestions.length} kayıt gösteriliyor.
                                                                </span>
                                                            </div>
                                                            <span>{s.suggestionTotal || s.suggestions.length} sonuç</span>
                                                        </div>

                                                        <div className="so-suggestions so-suggestions--grid so-suggestions--matched">
                                                            {s.suggestions.map((sg, i) =>
                                                                renderSuggestionCard(sg, s.rowIndex, label, i)
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="so-no-suggestion">
                                                        <AlertTriangle size={14} />
                                                        Alternatif yakın eşleşme bulunamadı.
                                                    </div>
                                                )
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="so-empty-state">Doğrudan eşleşen kayıt bulunamadı.</div>
                        )}
                    </div>

                    <div className="so-match-panel so-match-panel--warning">
                        <div className="so-match-panel__head">
                            <div>
                                <span className="so-match-panel__label">
                                    <XCircle size={16} color="var(--c-red)" />
                                    Manuel Seçim Bekleyen Kayıtlar
                                </span>
                                <small>Excel değeri birebir bulunamadı; yakın kayıtlar listelendi.</small>
                            </div>
                            <span className="so-badge so-badge--bad">{preview.unmatchedCount}</span>
                        </div>

                        {preview.unmatchedSamples?.length ? (
                            <ul className="so-match-list so-match-list--cards">
                                {preview.unmatchedSamples.map((s) => (
                                    <li key={`u-${s.rowIndex}-${label}`} className="so-match-item so-match-item--modern">
                                        <div className="so-record-index">Excel satırı #{s.rowIndex + 2}</div>

                                        <div className="so-unmatched-head">
                                            <div className="so-unmatched-source">
                                                <span className="so-match-col__label">{context.sourceLabel}</span>
                                                <div className="so-addr so-addr--bad">{s.before}</div>
                                            </div>

                                            <span className="so-badge so-badge--soft">
                                                {s.suggestionTotal || s.suggestions?.length || 0} yakın kayıt
                                            </span>
                                        </div>

                                        {!!s.suggestions?.length ? (
                                            <div className="so-alternative-area">
                                                <div className="so-alternative-area__head">
                                                    <div>
                                                        <strong>{context.targetLabel} önerileri</strong>
                                                        <span>
                                                            Sonuçlar benzerlik oranına göre yüksekten düşüğe sıralanmıştır.
                                                        </span>
                                                    </div>
                                                    <span>
                                                        {s.suggestions.length}
                                                        {s.suggestionTotal > s.suggestions.length
                                                            ? ` / ${s.suggestionTotal}`
                                                            : ""} gösteriliyor
                                                    </span>
                                                </div>

                                                <div className="so-suggestions so-suggestions--grid">
                                                    {s.suggestions.map((sg, i) =>
                                                        renderSuggestionCard(sg, s.rowIndex, label, i)
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="so-no-suggestion">
                                                <AlertTriangle size={14} />
                                                Benzer sistem kaydı bulunamadı. Excel değerini veya sistem kayıtlarını kontrol edin.
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="so-empty-state">Tüm kayıtlar eşleşti.</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

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

                <section className="so-workflow" aria-label="Sipariş oluşturma adımları">
                    <div className={`so-workflow__step ${selectedProject ? "is-done" : "is-active"}`}>
                        <span className="so-workflow__index">1</span>
                        <div><strong>Proje Seç</strong><small>Siparişin ait olduğu projeyi belirle</small></div>
                        {selectedProject && <CheckCircle2 size={17} />}
                    </div>
                    <div className={`so-workflow__line ${selectedProject ? "is-done" : ""}`} />
                    <div className={`so-workflow__step ${rows.length ? "is-done" : selectedProject ? "is-active" : ""}`}>
                        <span className="so-workflow__index">2</span>
                        <div><strong>Excel Yükle</strong><small>Şablonu doldur ve dosyanı bırak</small></div>
                        {rows.length > 0 && <CheckCircle2 size={17} />}
                    </div>
                    <div className={`so-workflow__line ${rows.length ? "is-done" : ""}`} />
                    <div className={`so-workflow__step ${rows.length ? "is-active" : ""}`}>
                        <span className="so-workflow__index">3</span>
                        <div><strong>Eşleştir</strong><small>Adres ve firma kayıtlarını doğrula</small></div>
                        <LinkIcon size={17} />
                    </div>
                    <div className="so-workflow__line" />
                    <div className="so-workflow__step">
                        <span className="so-workflow__index">4</span>
                        <div><strong>Aktar</strong><small>Kontrol edilen veriyi dışa aktar</small></div>
                        <FileSpreadsheet size={17} />
                    </div>
                </section>

                {/* ── Controls ── */}
                <div className="so-controls">
                    <div className="so-project-row">
                        <div className="so-project-heading">
                            <div className="so-project-heading__icon"><FolderKanban size={18} /></div>
                            <div>
                                <strong>Çalışılacak proje</strong>
                                <span>Excel verisinin bağlanacağı projeyi seç</span>
                            </div>
                        </div>

                        <div className="so-project-select-row">
                            <div className="so-field">
                                <label className="so-label">Proje seçimi</label>
                                <div className="so-select-shell">
                                    <select
                                        className={`so-select${isBallog ? " so-select--ballog" : ""}`}
                                        value={projeAdi}
                                        onChange={(e) => setProjeAdi(e.target.value)}
                                        disabled={projectsLoading}
                                    >
                                        <option value="">Proje seçiniz</option>
                                        {projectsLoading && <option disabled>Yükleniyor...</option>}
                                        {!projectsLoading && projectsError && <option disabled>Hata: {projectsError}</option>}
                                        {!projectsLoading && !projectsError && projects.map((p) => (
                                            <option key={p.id} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="so-select-shell__chevron" />
                                </div>
                            </div>
                            {selectedProject ? (
                                <div className={`so-project-badge so-project-badge--ok${isBallog ? " so-project-badge--ballog" : ""}`}>
                                    <CheckCircle2 size={15} />
                                    <span><small>Aktif proje</small>{selectedProject.name}</span>
                                </div>
                            ) : (
                                <div className="so-project-badge so-project-badge--empty">
                                    <FolderKanban size={14} />
                                    <span><small>Durum</small>Proje bekleniyor</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="so-action-panel">
                        <div className="so-action-panel__title">
                            <Zap size={15} />
                            <span>Hızlı işlemler</span>
                        </div>
                        <div className="so-action-group">
                        <button className="so-btn so-btn--primary" onClick={handleTemplateDownload} title="Şablonu indir">
                            <span className="so-btn__icon"><Download size={15} /></span>
                            <span>Şablon İndir</span>
                            <ArrowRight size={14} className="so-btn__arrow" />
                        </button>
                        {isBallog && (
                            <>
                                <button
                                    className="so-btn so-btn--ballog"
                                    onClick={pickBallogFile}
                                    disabled={ballogImporting}
                                    title="BALLOG teslim noktası ekle"
                                >
                                    <UploadCloud size={15} />
                                    {ballogImporting ? "Ekleniyor..." : "Teslim Noktası Ekle"}
                                </button>
                                <input
                                    ref={ballogFileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.xlsm"
                                    onChange={onBallogFileChange}
                                    hidden
                                />
                            </>
                        )}
                        <button
                            className={`so-btn${isBallog ? " so-btn--ballog" : ""}`}
                            onClick={handleEslesmeYap}
                            disabled={!projeAdi || overlayLoading || !rows.length}
                            title="Adres eşleştir"
                        >
                            <span className="so-btn__icon">{overlayLoading ? <LoaderCircle size={15} className="so-spin" /> : <LinkIcon size={15} />}</span>
                            <span>{overlayLoading ? "Eşleştiriliyor" : "Eşleştir"}</span>
                        </button>
                        <button
                            className="so-btn"
                            onClick={handleExportExcel}
                            disabled={!rows.length || !projeAdi}
                            title="Excel olarak aktar"
                        >
                            <span className="so-btn__icon"><FileSpreadsheet size={15} /></span>
                            <span>Excel Aktar</span>
                        </button>
                        <button
                            className="so-btn so-btn--danger"
                            onClick={handleTemizle}
                            disabled={!rows.length && !lastFile && !error}
                            title="Temizle"
                        >
                            <span className="so-btn__icon"><Trash2 size={15} /></span>
                        </button>
                        </div>
                    </div>
                </div>

                {/* ── Alerts ── */}
                {(error || lastFile || ballogImportResult) && (
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
                        {ballogImportResult && (
                            <div className="so-alert so-alert--success">
                                <CheckCircle2 size={15} />
                                BALLOG teslim noktası aktarımı: <strong>{ballogImportResult.inserted}</strong> yeni kayıt eklendi, <strong>{ballogImportResult.skipped}</strong> kayıt zaten vardı.
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
                                                {isUploading ? (
                                                    <div className="so-upload-progress">
                                                        <div className="so-upload-progress__orb">
                                                            <LoaderCircle size={28} className="so-spin" />
                                                            <span>{uploadProgress}%</span>
                                                        </div>
                                                        <div className="so-upload-progress__copy">
                                                            <strong>{uploadStage}</strong>
                                                            <span>{lastFile?.name || "Excel dosyası hazırlanıyor"}</span>
                                                        </div>
                                                        <div className="so-upload-progress__track">
                                                            <i style={{ width: `${uploadProgress}%` }} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className={`so-drop-icon${isBallog ? " so-drop-icon--ballog" : ""}`}>
                                                            <UploadCloud size={26} />
                                                            <span className="so-drop-icon__ring" />
                                                        </div>
                                                        <div className="so-drop-title">Excel dosyanı buraya sürükle</div>
                                                        <div className="so-drop-sub">veya <strong>dosya seçmek için tıkla</strong> · .xlsx / .xls</div>
                                                        {projeAdi ? (
                                                            <div className="so-drop-ready"><FileCheck2 size={13} /> {projeAdi} için yüklemeye hazır</div>
                                                        ) : (
                                                            <div className="so-drop-warn">
                                                                <AlertTriangle size={13} />
                                                                Önce proje seçmelisiniz
                                                            </div>
                                                        )}
                                                    </>
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
                                <div className="so-modal__eyebrow">Excel → Sistem kayıt eşleştirmesi</div>
                                <div className="so-modal__title">Adres ve Firma Eşleştirme Merkezi</div>
                                <div className="so-modal__desc">
                                    Her Excel satırının hangi sistem kaydıyla eşleştiğini inceleyin.
                                    Birebir bulunamayan kayıtlar için yakın sonuçlardan doğru kaydı seçin.
                                </div>
                            </div>

                            {(() => {
                                const activePreview =
                                    isBallog && matchModalTab === "yukleme"
                                        ? matchPreviewYukleme
                                        : matchPreview;

                                return (
                                    <div className="so-kpis">
                                        <span className="so-kpi so-kpi--neutral">
                                            Toplam satır <strong>{activePreview.total}</strong>
                                        </span>
                                        <span className="so-kpi so-kpi--good">
                                            <CheckCircle2 size={13} />
                                            <strong>{activePreview.matchedCount}</strong> eşleşti
                                        </span>
                                        <span className="so-kpi so-kpi--bad">
                                            <XCircle size={13} />
                                            <strong>{activePreview.unmatchedCount}</strong> seçim bekliyor
                                        </span>
                                    </div>
                                );
                            })()}
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