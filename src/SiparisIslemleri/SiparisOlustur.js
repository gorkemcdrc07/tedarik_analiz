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
    FileUp,
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

const emptyRow = () => HEADERS.reduce((acc, key) => ({ ...acc, [key]: "" }), {});
const sortTr = (a, b) => String(a).localeCompare(String(b), "tr", { sensitivity: "base" });
const normalize = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const excelSerialToDate = (val) => {
    const n = Number(val);
    if (!isFinite(n)) return null;

    const ms = n * 86400000;
    const d = new Date(Date.UTC(1899, 11, 30) + ms);

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

const enrichRow = (row) => enrichVehicleOnRow(enrichDatesOnRow(row));

const cleanAddr = (s) =>
    String(s ?? "")
        .toLocaleLowerCase("tr")
        .replace(/[\(\)\[\]\{\}\-_.]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const bigrams = (str) => {
    const s = str.replace(/\s+/g, "");
    const arr = [];

    for (let i = 0; i < Math.max(0, s.length - 1); i++) {
        arr.push(s.slice(i, i + 2));
    }

    return arr;
};

const diceCoefficient = (a, b) => {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const A = bigrams(a);
    const B = bigrams(b);

    if (!A.length || !B.length) return 0;

    const map = new Map();

    for (const g of A) {
        map.set(g, (map.get(g) ?? 0) + 1);
    }

    let inter = 0;

    for (const g of B) {
        const c = map.get(g) ?? 0;

        if (c > 0) {
            inter++;
            map.set(g, c - 1);
        }
    }

    return (2 * inter) / (A.length + B.length);
};

const scoreSimilarity = (q, cand) => {
    if (!q || !cand) return 0;
    if (q === cand) return 1;
    if (q.includes(cand) || cand.includes(q)) return 0.95;

    return diceCoefficient(q, cand);
};

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

    const columns = useMemo(() => HEADERS, []);

    const [matchModalOpen, setMatchModalOpen] = useState(false);
    const [matchPreview, setMatchPreview] = useState({
        total: 0,
        matchedCount: 0,
        unmatchedCount: 0,
        matchedSamples: [],
        unmatchedSamples: [],
    });
    const [matchResults, setMatchResults] = useState([]);

    const selectedProject = useMemo(
        () => projects.find((p) => p.name === projeAdi),
        [projects, projeAdi]
    );

    const filledCellCount = useMemo(() => {
        return rows.reduce((total, row) => {
            return total + columns.filter((col) => normalize(row[col]) !== "").length;
        }, 0);
    }, [rows, columns]);

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
                    .map((x) => ({
                        id: x?.id,
                        name: (x?.Proje_Adi ?? "").trim(),
                    }))
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
        [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ].includes(file.type);

    const fetchProjectRows = async (projectName) => {
        const { data, error } = await supabase
            .from(DATA_TABLE)
            .select(`${SELECT_COLS}, Proje_Adi`)
            .eq("Proje_Adi", projectName);

        if (error) throw error;

        return Array.isArray(data) ? data : [];
    };

    const applyOverlay = (prevRows, incoming) => {
        const outLen = Math.max(prevRows.length, incoming.length || 0);
        const hasAny = Array.isArray(incoming) && incoming.length > 0;

        const out = Array.from({ length: outLen }).map((_, i) => {
            const base = prevRows[i] ? { ...prevRows[i] } : emptyRow();

            const rec = hasAny ? incoming[i] ?? incoming[incoming.length - 1] : null;

            if (rec) {
                Object.entries(FIELD_OVERLAY_MAP).forEach(([src, dest]) => {
                    if (src === "proje_id") {
                        base[dest] = String(rec.proje_id ?? "");
                    } else {
                        base[dest] = normalize(rec[src] ?? base[dest]);
                    }
                });
            }

            return enrichRow(base);
        });

        return out;
    };

    const parseExcel = async (file) => {
        setError("");

        try {
            if (!projeAdi) {
                throw new Error("Excel yüklemeden önce lütfen bir proje seçin.");
            }

            if (!isExcelFile(file)) {
                throw new Error("Lütfen .xlsx / .xls dosyası yükleyin.");
            }

            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

            if (!aoa || aoa.length === 0) {
                throw new Error("Boş sayfa görünüyor.");
            }

            const [rawHeaders, ...body] = aoa;

            const headerIndexMap = {};

            HEADERS.forEach((h) => {
                const idx = rawHeaders.findIndex((x) => normalize(x) === normalize(h));
                headerIndexMap[h] = idx;
            });

            const missing = REQUIRED_EXPORT_HEADERS.filter((h) => headerIndexMap[h] === -1);

            if (missing.length) {
                throw new Error(`Eksik başlık: ${missing.join(", ")}. Lütfen şablonu kullanın.`);
            }

            const parsedRows = body
                .filter((row) => row.some((cell) => normalize(cell) !== ""))
                .map((row) => {
                    const obj = {};

                    HEADERS.forEach((h) => {
                        const idx = headerIndexMap[h];
                        obj[h] = idx >= 0 ? normalize(row[idx]) : "";
                    });

                    return enrichRow(obj);
                })
                .map((r) => ({ ...r, Proje: projeAdi || "" }));

            try {
                const incoming = await fetchProjectRows(projeAdi);
                const merged = applyOverlay(parsedRows, incoming);
                setRows(merged);
            } catch (er) {
                setRows(parsedRows);
                setError(er.message || "Proje verileri alınamadı fakat Excel yüklendi.");
            }

            setLastFile(file);
        } catch (e) {
            setRows([]);
            setError(e.message || "Excel okunamadı.");
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragActive(false);

        const f = e.dataTransfer.files?.[0];

        if (f) {
            parseExcel(f);
        }
    };

    const onDragOver = (e) => {
        e.preventDefault();
        setDragActive(true);
    };

    const onDragLeave = () => {
        setDragActive(false);
    };

    const pickFile = () => {
        if (!projeAdi) {
            setError("Excel seçmeden önce lütfen bir proje seçin.");
            return;
        }

        fileInputRef.current?.click();
    };

    const onFileChange = (e) => {
        const f = e.target.files?.[0];

        if (f) {
            parseExcel(f);
        }

        e.target.value = "";
    };

    const handleTemplateDownload = async () => {
        try {
            const cols = REQUIRED_EXPORT_HEADERS;
            const wsData = [cols, ...[emptyRow()].map((r) => cols.map((c) => r[c] ?? ""))];
            const wsSablon = XLSX.utils.aoa_to_sheet(wsData);

            let allData = [];
            const pageSize = 1000;

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

        const cols = [...columns];
        const aoa = [cols, ...rows.map((r) => columns.map((c) => r[c] ?? ""))];

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, ws, "Tablo");

        const iso = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Siparisler_${projeAdi || "Proje"}_${iso}.xlsx`);
    };

    const handleEslesmeYap = async () => {
        try {
            if (!projeAdi) {
                setError("Eşleşme yapmadan önce lütfen bir proje seçin.");
                return;
            }

            if (!rows.length) {
                setError("Eşleşme yapmadan önce lütfen Excel yükleyin.");
                return;
            }

            setError("");
            setOverlayLoading(true);

            let workingRows = rows;

            try {
                const incoming = await fetchProjectRows(projeAdi);

                if (incoming && incoming.length) {
                    workingRows = applyOverlay(rows, incoming);
                    setRows(workingRows);
                }
            } catch (_) { }

            const key = (s) =>
                String(s ?? "")
                    .replace(/\u00A0/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLocaleUpperCase("tr");

            const pageSize = 1000;

            const { count, error: countError } = await supabase
                .from("Teslim_Noktalari")
                .select("*", { count: "exact", head: true });

            if (countError) throw countError;

            const total = count || 0;
            const totalPages = Math.ceil(total / pageSize);

            let allAdresler = [];

            for (let page = 0; page < totalPages; page++) {
                const from = page * pageSize;
                const to = from + pageSize - 1;

                const { data, error } = await supabase
                    .from("Teslim_Noktalari")
                    .select("adres_id, adres_adi, cari_hesap_id")
                    .range(from, to);

                if (error) throw error;

                allAdresler = allAdresler.concat(data || []);
            }

            const byAdresAdi = new Map();

            const candidateList = allAdresler.map((a) => {
                const item = {
                    adres_id: a?.adres_id ?? "",
                    adres_adi: a?.adres_adi ?? "",
                    cari_hesap_id: a?.cari_hesap_id ?? "",
                };

                byAdresAdi.set(key(item.adres_adi), item);

                return {
                    ...item,
                    _clean: cleanAddr(item.adres_adi),
                };
            });

            const SIM_THRESHOLD = 0.78;
            const TOP_N = 3;

            const results = workingRows.map((row, idx) => {
                const qRaw = row["Teslim Firma Adres Adı"];
                const exact = byAdresAdi.get(key(qRaw));

                if (exact) {
                    return {
                        rowIndex: idx,
                        ok: true,
                        before: qRaw,
                        matchedAdresAdi: exact.adres_adi,
                        matchedAdresId: exact.adres_id,
                        matchedCariId: exact.cari_hesap_id,
                        score: 1,
                        suggestions: [],
                    };
                }

                const qClean = cleanAddr(qRaw);

                const suggestions = candidateList
                    .map((c) => ({
                        ...c,
                        _score: scoreSimilarity(qClean, c._clean),
                    }))
                    .filter((x) => x._score >= SIM_THRESHOLD)
                    .sort((a, b) => b._score - a._score)
                    .slice(0, TOP_N)
                    .map((s) => ({
                        adres_adi: s.adres_adi,
                        adres_id: s.adres_id,
                        cari_hesap_id: s.cari_hesap_id,
                        score: Number(s._score.toFixed(2)),
                    }));

                return {
                    rowIndex: idx,
                    ok: false,
                    before: qRaw,
                    score: 0,
                    suggestions,
                };
            });

            const matched = results.filter((r) => r.ok);
            const unmatched = results.filter((r) => !r.ok);

            setMatchResults(results);

            setMatchPreview({
                total: workingRows.length,
                matchedCount: matched.length,
                unmatchedCount: unmatched.length,
                matchedSamples: matched.slice(0, 20).map((r) => ({
                    rowIndex: r.rowIndex,
                    before: r.before,
                    matchedAdresAdi: r.matchedAdresAdi,
                    matchedAdresId: r.matchedAdresId,
                    matchedCariId: r.matchedCariId,
                })),
                unmatchedSamples: unmatched.slice(0, 20).map((r) => ({
                    rowIndex: r.rowIndex,
                    before: r.before || "—",
                    suggestions: r.suggestions || [],
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
        setRows((prev) => {
            const byIndex = new Map();

            for (const r of matchResults) {
                if (r.ok) {
                    byIndex.set(r.rowIndex, r);
                }
            }

            return prev.map((row, i) => {
                const m = byIndex.get(i);

                if (!m) return row;

                return {
                    ...row,
                    ["Teslim Firma Adres Adı"]: String(m.matchedAdresId ?? ""),
                    ["Alıcı Firma Cari Adı"]: String(m.matchedCariId ?? ""),
                };
            });
        });

        setMatchModalOpen(false);
    };

    const handleTemizle = () => {
        setRows([]);
        setLastFile(null);
        setError("");
        setMatchResults([]);
        setMatchPreview({
            total: 0,
            matchedCount: 0,
            unmatchedCount: 0,
            matchedSamples: [],
            unmatchedSamples: [],
        });
        setMatchModalOpen(false);
    };

    return (
        <div className="so-page">
            <section className="so-hero">
                <div className="so-hero__content">
                    <div className="so-eyebrow">
                        <Sparkles size={16} />
                        Modern sipariş yönetimi
                    </div>

                    <h1 className="so-title">Sipariş Oluştur</h1>

                    <p className="so-subtitle">
                        Excel şablonunu indir, proje seç, dosyanı yükle ve adres eşleşmelerini
                        güvenle onayla.
                    </p>
                </div>

                <div className="so-hero__stats">
                    <div className="so-stat">
                        <span>{projects.length}</span>
                        <small>Proje</small>
                    </div>

                    <div className="so-stat">
                        <span>{rows.length}</span>
                        <small>Satır</small>
                    </div>

                    <div className="so-stat">
                        <span>{filledCellCount}</span>
                        <small>Dolu Hücre</small>
                    </div>
                </div>
            </section>

            <section className="so-top-grid">
                <div className="so-card so-project-card">
                    <div className="so-card__head">
                        <div className="so-icon-box">
                            <FolderKanban size={20} />
                        </div>

                        <div>
                            <h2>Proje Seçimi</h2>
                            <p>Excel yüklemeden önce çalışılacak projeyi seçin.</p>
                        </div>
                    </div>

                    <label className="so-label">
                        Proje Adı <span>*</span>
                    </label>

                    <select
                        className="so-input"
                        value={projeAdi}
                        onChange={(e) => setProjeAdi(e.target.value)}
                        disabled={projectsLoading}
                    >
                        <option value="">Proje seçiniz</option>

                        {projectsLoading && <option>Projeler yükleniyor...</option>}

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

                    {selectedProject ? (
                        <div className="so-selected-project">
                            <CheckCircle2 size={16} />
                            <span>
                                Seçili proje: <b>{selectedProject.name}</b>
                            </span>
                        </div>
                    ) : (
                        <div className="so-muted-box">Henüz proje seçilmedi.</div>
                    )}
                </div>

                <div className="so-card so-actions-card">
                    <div className="so-card__head">
                        <div className="so-icon-box so-icon-box--green">
                            <FileUp size={20} />
                        </div>

                        <div>
                            <h2>İşlemler</h2>
                            <p>Şablon indir, eşleştir veya Excel çıktısı al.</p>
                        </div>
                    </div>

                    <div className="so-actions">
                        <button className="so-btn so-btn-primary" onClick={handleTemplateDownload}>
                            <Download size={18} />
                            Şablonu İndir
                        </button>

                        <button
                            className="so-btn"
                            onClick={handleEslesmeYap}
                            disabled={!projeAdi || overlayLoading || !rows.length}
                        >
                            <LinkIcon size={18} />
                            {overlayLoading ? "Eşleştiriliyor..." : "Eşleşme Yap"}
                        </button>

                        <button
                            className="so-btn"
                            onClick={handleExportExcel}
                            disabled={!rows.length || !projeAdi}
                        >
                            <FileSpreadsheet size={18} />
                            Excel Olarak Aktar
                        </button>
                    </div>
                </div>
            </section>

            <section className="so-table-card">
                <div className="so-table-header">
                    <div>
                        <div className="so-table-title">
                            <ListChecks size={19} />
                            <span>Sipariş Şablonu</span>
                        </div>

                        <p>
                            Sipariş tarihi kısa tarih formatına çevrilir. Yükleme tarihi sipariş
                            tarihi olur. Teslim tarihi +1 gün hesaplanır. Araç tipi otomatik koda
                            dönüştürülür.
                        </p>
                    </div>

                    <div className="so-table-actions">
                        <button
                            className="so-btn so-btn-danger"
                            onClick={handleTemizle}
                            disabled={!rows.length && !lastFile && !error}
                            title="Tabloyu ve uyarıları temizle"
                        >
                            <Trash2 size={17} />
                            Temizle
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="so-alert so-alert--error">
                        <XCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {lastFile && (
                    <div className="so-alert so-alert--success">
                        <CheckCircle2 size={18} />
                        <span>
                            Yüklü dosya: <b>{lastFile.name}</b>
                        </span>
                    </div>
                )}

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
                                            className={`so-drop-in-table ${dragActive ? "active" : ""} ${!projeAdi ? "disabled" : ""
                                                }`}
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
                                            <div className="so-upload-icon">
                                                <UploadCloud size={34} />
                                            </div>

                                            <div className="so-drop-title">
                                                Excel dosyanı buraya sürükle
                                            </div>

                                            <div className="so-drop-sub">
                                                veya <b>tıklayıp seç</b> (.xlsx / .xls)
                                            </div>

                                            {!projeAdi && (
                                                <div className="so-drop-warning">
                                                    Önce proje seçmelisiniz.
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
                                    <tr key={rowIdx}>
                                        <td className="so-index">{rowIdx + 1}</td>

                                        {columns.map((col) => (
                                            <td key={`${rowIdx}-${col}`} title={row[col] || ""}>
                                                <div className="so-cell-text">
                                                    {row[col] || "—"}
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="so-footnote">
                    İpucu: Önce “Şablonu İndir” ile doğru başlıkları alıp doldurun, sonra Excel’i
                    bu alana yükleyin. Tablo yatay kaydırmalıdır; başlıklar ve sıra numarası sabit kalır.
                </div>
            </section>

            {matchModalOpen && (
                <div className="so-modal-backdrop" role="dialog" aria-modal="true">
                    <div className="so-modal">
                        <div className="so-modal__body">
                            <div className="so-modal__header">
                                <div>
                                    <h3 className="so-modal__title">Adres Eşleşme Özeti</h3>
                                    <p className="so-modal__desc">
                                        Eşleşen kayıtlar onay sonrası tabloya uygulanır.
                                    </p>
                                </div>

                                <div className="so-kpis">
                                    <span className="so-chip so-chip--neutral">
                                        Toplam <b>{matchPreview.total}</b>
                                    </span>

                                    <span className="so-chip so-chip--good">
                                        Eşleşen <b>{matchPreview.matchedCount}</b>
                                    </span>

                                    <span className="so-chip so-chip--bad">
                                        Eşleşmeyen <b>{matchPreview.unmatchedCount}</b>
                                    </span>
                                </div>
                            </div>

                            <div className="so-modal__grid">
                                <div className="so-card-simple">
                                    <div className="so-card-simple__header">
                                        <span className="so-card-simple__title">
                                            <CheckCircle2 size={16} />
                                            Eşleşenler
                                        </span>

                                        <span className="so-badge">
                                            {matchPreview.matchedCount}
                                        </span>
                                    </div>

                                    {matchPreview.matchedSamples?.length ? (
                                        <ul className="match-list">
                                            {matchPreview.matchedSamples.map((s) => (
                                                <li key={`m-${s.rowIndex}`} className="match-item">
                                                    <div className="match-line">
                                                        <div className="match-cell our">
                                                            <span className="label">
                                                                Bizim Adres
                                                            </span>

                                                            <div className="addr">
                                                                {s.before}
                                                            </div>
                                                        </div>

                                                        <div className="arrow">→</div>

                                                        <div className="match-cell real">
                                                            <span className="label">
                                                                Sistemdeki Adres
                                                            </span>

                                                            <div className="addr">
                                                                {s.matchedAdresAdi}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="meta">
                                                        <span className="tag">
                                                            adres_id: {s.matchedAdresId}
                                                        </span>

                                                        <span className="tag">
                                                            cari_hesap_id: {s.matchedCariId}
                                                        </span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="so-empty">Eşleşen kayıt yok.</div>
                                    )}
                                </div>

                                <div className="so-card-simple">
                                    <div className="so-card-simple__header">
                                        <span className="so-card-simple__title">
                                            <XCircle size={16} />
                                            Eşleşmeyenler
                                        </span>

                                        <span className="so-badge so-badge--bad">
                                            {matchPreview.unmatchedCount}
                                        </span>
                                    </div>

                                    {matchPreview.unmatchedSamples?.length ? (
                                        <ul className="match-list">
                                            {matchPreview.unmatchedSamples.map((s) => (
                                                <li key={`u-${s.rowIndex}`} className="match-item">
                                                    <div className="match-line">
                                                        <div className="match-cell our">
                                                            <span className="label">
                                                                Bizim Adres
                                                            </span>

                                                            <div className="addr">
                                                                {s.before}
                                                            </div>
                                                        </div>

                                                        <div className="arrow">→</div>

                                                        <div className="match-cell none">
                                                            <span className="label">
                                                                Sistemde
                                                            </span>

                                                            <div className="addr notfound">
                                                                Bulunamadı
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {!!s.suggestions?.length && (
                                                        <div className="suggestions">
                                                            {s.suggestions.map((suggestion, index) => (
                                                                <span
                                                                    className="suggestion-chip"
                                                                    key={`${s.rowIndex}-${index}`}
                                                                >
                                                                    {suggestion.adres_adi} · %
                                                                    {Math.round(
                                                                        suggestion.score * 100
                                                                    )}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="so-empty">Hepsi eşleşti 🎉</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="so-modal__actions">
                            <button className="so-btn" onClick={() => setMatchModalOpen(false)}>
                                Vazgeç
                            </button>

                            <button className="so-btn so-btn-primary" onClick={confirmApplyMatches}>
                                Onayla ve Uygula
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}