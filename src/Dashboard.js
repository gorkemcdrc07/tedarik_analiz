import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";


const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Bölge -> Projeler ---
const REGION_PROJECTS = {
    TRAKYA: [
        "BUNGE LÜLEBURGAZ FTL",
        "BUNGE GEBZE FTL",
        "BUNGE PALET",
        "REKA FTL",
        "EKSUN GIDA FTL",
        "SARUHAN FTL",
        "PEPSİ FTL",
        "TEKİRDAĞ UN FTL",
        "AYDINLI MODA FTL",
        "ADKOTURK FTL",
        "ADKOTURK FTL ENERJİ İÇECEĞİ",
        "SGS FTL",
        "BSH FTL",
        "ALTERNA GIDA FTL",
        "DERYA OFİS FTL",
        "SAPRO FTL",
        "MARMARA CAM FTL",
        "FAKİR FTL",
        "MODERN KARTON-NİŞASTA",
        "MODERN KARTON-PACKON",
        "KÜÇÜKBAY TRAKYA",
    ],
    HEDEF: ["HEDEF FTL", "HEDEF DIŞ TEDARİK"],
    GEBZE: [
        "PEPSİ FTL GEBZE",
        "MİLHANS FTL",
        "AYDIN KURUYEMİŞ FTL",
        "AVANSAS FTL",
        "AVANSAS SPOT FTL",
        "DSV ERNAMAŞ FTL",
        "E-BEBEK FTL GEBZE",
        "FLO FTL",
        "ÇİÇEKÇİ FTL",
        "ÇİZMECİ GIDA FTL",
        "OTTONYA",
    ],
    ARKAS: ["ARKAS DERİNCE", "ARKAS DIŞ TERMİNAL"],
    EGE: ["KÜÇÜKBAY FTL", "EURO GIDA  FTL", "E-BEBEK UŞAK", "SARKAP FTL", "İZMİR SPOT"],
    ÇUKUROVA: ["PEKER FTL", "GDP FTL", "ADANA SPOT", "ÖZMEN UN FTL", "KİPAŞ MARAŞ FTL"],
};

// Grup başlığı için birleştirme
const projectMergeMap = {
    "MODERN KARTON FTL": ["MODERN KARTON-PACKON", "MODERN KARTON-NİŞASTA"],
};

// Yardımcılar
const todayStr = new Date().toISOString().split("T")[0];
const pad = (d, n) => String(d).padStart(n, "0");
const toTR = (n) => (Number.isFinite(n) ? n.toLocaleString("tr-TR") : "0");

function addDays(dateStr, delta) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + delta);
    return d.toISOString().split("T")[0];
}

function normalizeProjectName(name) {
    const map = {
        "BUNGE DİLOVASI-REYSAŞ": "BUNGE GEBZE FTL",
        "BUNGE PALET": "BUNGE PALET",
        "BUNGE LÜLEBURGAZ FTL": "BUNGE LÜLEBURGAZ FTL",
    };
    return map[name] || name;
}

function mapHeaderKey(k) {
    if (!k) return k;
    const s = String(k).trim();
    const dict = {
        "PROJE ADI": "PROJE_ADI",
        TALEP: "TALEP",
        TEDARİK: "TEDARIK",
        "VERİLEMEYEN": "VERILEMEYEN",
        SPOT: "SPOT",
        FİLO: "FILO",
        TESİSTE: "TESISTE",
        GELECEK: "GELECEK",
        YÜKLENDİ: "YUKLENDI",
        "TOP. NAVLUN": "TOP_NAVLUN",
        "HEDEF ÜSTÜ": "HEDEF_USTU",
        "HEDEF ALTI": "HEDEF_ALTI",
        "HEDEFSİZ SEFER": "HEDEFSIZ_SEFER",
        GELİR: "GELIR",
        "TED. %": "TED_YUZDE",
        SEFER_ÜSTÜ: "SEFER_USTU",
        SEFER_ALTI: "SEFER_ALTI",
        SEFER_HEDEF: "SEFER_HEDEF",
        "DEVREDEN TALEP": "DEVREDEN_TALEP",
        "TOPLAM TALEP": "TOPLAM_TALEP",
        "TOPLAM TEDARİK": "TOPLAM_TEDARIK",
        TOP_HEDEF_NAVLUN: "TOP_HEDEF_NAVLUN",
        "TOP HEDEF NAVLUN": "TOP_HEDEF_NAVLUN",
        "TOP. HEDEF NAVLUN": "TOP_HEDEF_NAVLUN",
        TOP_HEDEF_NAVL_HDF_UST: "TOP_HEDEF_NAVL_HDF_UST",
        "TOP HEDEF NAVL HDF UST": "TOP_HEDEF_NAVL_HDF_UST",
        "TOP. HEDEF NAVL HDF UST": "TOP_HEDEF_NAVL_HDF_UST",
    };
    return dict[s] || s;
}

/* ---- UI Pieces ---- */
function Toolbar({ region, setRegion, startDate, setStartDate, endDate, setEndDate, onFilter, loading }) {
    const presets = [
        { key: "today", label: "Bugün", range: () => [todayStr, todayStr] },
        { key: "yesterday", label: "Dün", range: () => [addDays(todayStr, -1), addDays(todayStr, -1)] },
        {
            key: "thisWeek",
            label: "Bu Hafta",
            range: () => {
                const d = new Date();
                const day = d.getDay(); 
                const start = addDays(todayStr, -(day === 0 ? 6 : day - 1));
                return [start, todayStr];
            },
        },
        { key: "last7", label: "Son 7 gün", range: () => [addDays(todayStr, -6), todayStr] },
    ];

    return (
        <div className="toolbar">
            <div className="toolbar-row">
                <div className="region-pills" role="tablist" aria-label="Bölge seçimi">
                    {Object.keys(REGION_PROJECTS).map((r) => (
                        <button
                            key={r}
                            role="tab"
                            aria-selected={region === r}
                            className={`pill ${region === r ? "pill--active" : ""}`}
                            onClick={() => setRegion(r)}
                            title={`${r} bölgesini seç`}
                        >
                            {r}
                        </button>
                    ))}
                </div>

                <div className="date-controls">
                    <label>
                        <span>Başlangıç</span>
                        <input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
                    </label>
                    <label>
                        <span>Bitiş</span>
                        <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
                    </label>
                    <div className="preset-group">
                        {presets.map((p) => (
                            <button
                                key={p.key}
                                className="btn btn--ghost"
                                onClick={() => {
                                    const [s, e] = p.range();
                                    setStartDate(s);
                                    setEndDate(e);
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <button className="btn" onClick={onFilter} disabled={loading}>
                        {loading ? "Filtreleniyor…" : "Uygula"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Modal({ open, title, onClose, children }) {
    if (!open) return null;
    return (
        <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
            <div className="modal__scrim" onClick={onClose} />
            <div className="modal__card">
                <div className="modal__header">
                    <h3>{title}</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Kapat">
                        ✕
                    </button>
                </div>
                <div className="modal__body">{children}</div>
            </div>
        </div>
    );
}

/* ---- Small UI helpers for readability ---- */
const COL_GROUP = {
    TALEP: "TALEP",
    "REEL TALEP": "TALEP",
    TEDARIK: "TEDARIK",
    "REEL TEDARIK": "TEDARIK",
    VERILEMEYEN: "VERILEMEYEN",
    "REEL VERILEMEYEN": "VERILEMEYEN",
    SPOT: "SPOT",
    "REEL SPOT": "SPOT",
    FILO: "FILO",
    "REEL FILO": "FILO",
    TESISTE: "TESISTE",
    "REEL TESISTE": "TESISTE",
    GELECEK: "GELECEK",
    "REEL GELECEK": "GELECEK",
    YUKLENDI: "YUKLENDI",
    "REEL YUKLENDI": "YUKLENDI",
    TOP_NAVLUN: "MONEY",
    HEDEF_USTU: "MONEY",
    HEDEF_ALTI: "MONEY",
    HEDEF: "MONEY",
    TOP_HEDEF_NAVLUN: "MONEY",
    GELIR: "MONEY",
    TED_YUZDE: "PCT",
    UYUM: "PCT",
    TOP_HEDEF_NAVL_HDF_UST: "PCT",
};
const colGroupOf = (c) => COL_GROUP[c] || "";

const Pill = ({ text, tone }) => <span className={`pill-val ${tone ? `pill--${tone}` : ""}`}>{text}</span>;

/* ---- Main ---- */
export default function Dashboard() {
    // Kullanıcı / yetki
    const userObj = JSON.parse(localStorage.getItem("kullanici") || "{}");
    const user = (userObj.kullanici || "").trim().toLocaleUpperCase("tr-TR");
    const isPriv = ["ONUR KEREM ÖZTÜRK", "TAHSİN BENLİ", "ATAKAN AKALIN", "ENVER BEŞİRLİ"].includes(user);

    // Columns
    const columnOrder = useMemo(
        () => [
            "PROJE_ADI",
            "TALEP",
            "REEL TALEP",
            "TEDARIK",
            "REEL TEDARIK",
            "VERILEMEYEN",
            "REEL VERILEMEYEN",
            "DEVREDEN_TALEP",
            "TOPLAM_TALEP",
            "TOPLAM_TEDARIK",
            "TED_YUZDE",
            "UYUM",
            "SPOT",
            "REEL SPOT",
            "FILO",
            "REEL FILO",
            "TESISTE",
            "REEL TESISTE",
            "GELECEK",
            "REEL GELECEK",
            "YUKLENDI",
            "REEL YUKLENDI",
            ...(isPriv
                ? [
                    "TOP_NAVLUN",
                    "HEDEF_USTU",
                    "SEFER_USTU",
                    "HEDEF_ALTI",
                    "SEFER_ALTI",
                    "HEDEF",
                    "SEFER_HEDEF",
                    "HEDEFSIZ_SEFER",
                    "TOP_HEDEF_NAVLUN",
                    "TOP_HEDEF_NAVL_HDF_UST",
                    "GELIR",
                ]
                : []),
        ],
        [isPriv]
    );

    const HIDDEN_COLUMNS = useMemo(
        () => [
            "TOP_NAVLUN",
            "HEDEF_USTU",
            "SEFER_USTU",
            "HEDEF_ALTI",
            "SEFER_ALTI",
            "SEFER_HEDEF",
            "HEDEFSIZ_SEFER",
            "GELIR",
            "TOP_HEDEF_NAVLUN",
            "TOP_HEDEF_NAVL_HDF_UST",
        ],
        []
    );

    const columns = isPriv ? columnOrder : columnOrder.filter((c) => !HIDDEN_COLUMNS.includes(c));

    // State
    const [data, setData] = useState([]); // [header, ...rows]
    const [rawEtablo, setRawEtablo] = useState([]);
    const [odakData, setOdakData] = useState([]);
    const [odakDataRaw, setOdakDataRaw] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState("");
    const [selectedRecords, setSelectedRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [region, setRegion] = useState("TRAKYA");
    const allowedSet = useMemo(() => new Set(REGION_PROJECTS[region] || []), [region]);

    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);


    useEffect(() => {

        console.log("ENV KONTROL", {
            SUPA_URL: !!process.env.REACT_APP_SUPABASE_URL,
            SUPA_KEY: !!process.env.REACT_APP_SUPABASE_KEY,
            API_BASE: process.env.REACT_APP_API_BASE_URL,
            ODAK_KEY_PRESENT: !!process.env.REACT_APP_ODAK_API_KEY,
        });
    }, []);


    const buildTableFromOdak = useCallback((list, allowed) => {
        const header = [
            "PROJE_ADI",
            "TALEP",
            "REEL TALEP",
            "TEDARIK",
            "REEL TEDARIK",
            "VERILEMEYEN",
            "REEL VERILEMEYEN",
            "DEVREDEN_TALEP",
            "TOPLAM_TALEP",
            "TOPLAM_TEDARIK",
            "TED_YUZDE",
            "UYUM",
            "SPOT",
            "REEL SPOT",
            "FILO",
            "REEL FILO",
            "TESISTE",
            "REEL TESISTE",
            "GELECEK",
            "REEL GELECEK",
            "YUKLENDI",
            "REEL YUKLENDI",
        ];

        const rows = list
            .filter((p) => allowed.has(p.ProjectName))
            .map((p) => {
                const talep = 0;
                const tedarik = 0;
                const verilemeyen = 0;
                const reelTalep = p.Talep || 0;
                const reelTedarik = p.Tedarik || 0;
                const reelVerilemeyen = p.Verilemeyen || 0;
                const tedYuzde = talep > 0 ? tedarik / talep : 0;
                const uyum = reelTalep > 0 ? reelTedarik / reelTalep : 0;

                return {
                    PROJE_ADI: p.ProjectName,
                    TALEP: talep,
                    "REEL TALEP": reelTalep,
                    TEDARIK: tedarik,
                    "REEL TEDARIK": reelTedarik,
                    VERILEMEYEN: verilemeyen,
                    "REEL VERILEMEYEN": reelVerilemeyen,
                    DEVREDEN_TALEP: 0,
                    TOPLAM_TALEP: talep,
                    TOPLAM_TEDARIK: tedarik,
                    TED_YUZDE: tedYuzde,
                    UYUM: uyum,
                    SPOT: 0,
                    "REEL SPOT": p.Spot || 0,
                    FILO: 0,
                    "REEL FILO": p.Filo || 0,
                    TESISTE: 0,
                    "REEL TESISTE": 0,
                    GELECEK: 0,
                    "REEL GELECEK": 0,
                    YUKLENDI: 0,
                    "REEL YUKLENDI": 0,
                };
            });

        return [header, ...rows];
    }, []);

    const fetchSupabaseDailySum = useCallback(async (startStr, endStr) => {
        try {
            setError("");
            const shiftDay = (ymd, delta) => {
                const d = new Date(`${ymd}T00:00:00Z`);
                d.setUTCDate(d.getUTCDate() + delta);
                return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
            };
            const fromISO = `${shiftDay(startStr, -1)}T00:00:00Z`;
            const toISO = `${shiftDay(endStr, +1)}T23:59:59.999Z`;

            const { data: rows, error } = await supabase
                .from("toplu_sonuclar")
                .select("json_data, created_at")
                .gte("created_at", fromISO)
                .lte("created_at", toISO)
                .order("created_at", { ascending: true });

            if (error) throw error;
            if (!rows || rows.length === 0) {
                setRawEtablo([]);
                return;
            }

            const fmt = new Intl.DateTimeFormat("tr-TR", {
                timeZone: "Europe/Istanbul",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            });
            const dayKey = (iso) => {
                const d = new Date(iso);
                const [g, a, y] = fmt.format(d).split(".");
                return `${y}-${a}-${g}`;
            };

            const lastOfDay = new Map();
            for (const r of rows) lastOfDay.set(dayKey(r.created_at), r);
            const dailyPairs = Array.from(lastOfDay.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

            let dailyLatest = dailyPairs.filter(([gun]) => gun >= startStr && gun <= endStr).map(([, r]) => r);

            if (dailyLatest.length === 0 && dailyPairs.length > 0) {
                const fallbackPair = [...dailyPairs].filter(([gun]) => gun <= endStr).slice(-1)[0];
                if (fallbackPair) dailyLatest = [fallbackPair[1]];
            }

            if (dailyLatest.length === 0) {
                setRawEtablo([]);
                return;
            }

            const numericCols = new Set([
                "TALEP",
                "TEDARIK",
                "VERILEMEYEN",
                "SPOT",
                "FILO",
                "TESISTE",
                "GELECEK",
                "YUKLENDI",
                "DEVREDEN_TALEP",
                "TOPLAM_TALEP",
                "TOPLAM_TEDARIK",
                "TOP_NAVLUN",
                "HEDEF_USTU",
                "SEFER_USTU",
                "HEDEF_ALTI",
                "SEFER_ALTI",
                "HEDEF",
                "SEFER_HEDEF",
                "HEDEFSIZ_SEFER",
                "GELIR",
                "TOP_HEDEF_NAVLUN",
                "TOP_HEDEF_NAVL_HDF_UST",
            ]);

            const normalizeHeaderRow = (rawHeader) => {
                let header = [...rawHeader];
                let seferCounter = 1;
                for (let i = 0; i < header.length; i++) {
                    if (header[i] === "SEFER") {
                        const prev = header[i - 1];
                        if (prev === "HEDEF ÜSTÜ") header[i] = "SEFER_ÜSTÜ";
                        else if (prev === "HEDEF ALTI") header[i] = "SEFER_ALTI";
                        else if (prev === "HEDEF") header[i] = "SEFER_HEDEF";
                        else header[i] = `SEFER_${seferCounter++}`;
                    }
                }
                return header.map(mapHeaderKey);
            };

            const parseSnapshot = (snap) => {
                const jd = snap.json_data;
                if (jd && Array.isArray(jd.body) && jd.body.length && typeof jd.body[0] === "object") {
                    const body = jd.body;
                    const rawHeader = Object.keys(body[0]);
                    const header = rawHeader.map(mapHeaderKey);
                    const rows = body.map((obj) => {
                        const o = {};
                        for (const k of rawHeader) o[mapHeaderKey(k)] = obj[k];
                        return o;
                    });
                    return { header, rows };
                }

                if (Array.isArray(jd) && jd.length && typeof jd[0] === "object" && !jd[0].json_data) {
                    const rawHeader = Object.keys(jd[0]);
                    const header = rawHeader.map(mapHeaderKey);
                    const rows = jd.map((obj) => {
                        const o = {};
                        for (const k of rawHeader) o[mapHeaderKey(k)] = obj[k];
                        return o;
                    });
                    return { header, rows };
                }

                if (jd && typeof jd === "object") {
                    const cols = jd.columns || jd.header || jd.Headers || jd.kolonlar;
                    const arrRows = jd.rows || jd.data || jd.bodyRows || jd.veriler;
                    if (Array.isArray(cols) && Array.isArray(arrRows)) {
                        const header = cols.map(mapHeaderKey);
                        const rows = arrRows.map((arr) => {
                            const o = {};
                            header.forEach((h, i) => (o[h] = Array.isArray(arr) ? arr[i] : arr?.[i]));
                            return o;
                        });
                        return { header, rows };
                    }
                    const vals = Object.values(jd);
                    const keys = Object.keys(jd);
                    if (vals.length && Array.isArray(vals[0])) {
                        const rowCount = Math.max(...vals.map((v) => (Array.isArray(v) ? v.length : 0)));
                        const header = keys.map(mapHeaderKey);
                        const rows = Array.from({ length: rowCount }, (_, r) => {
                            const o = {};
                            keys.forEach((k) => (o[mapHeaderKey(k)] = Array.isArray(jd[k]) ? jd[k][r] : undefined));
                            return o;
                        });
                        return { header, rows };
                    }
                }

                const headerOld = jd?.[0]?.json_data || [];
                if (Array.isArray(headerOld)) {
                    const header = normalizeHeaderRow(headerOld);
                    const rows = (jd || []).slice(1).map((r) => {
                        const arr = r.json_data || [];
                        const o = {};
                        header.forEach((h, i) => {
                            o[h] = arr[i];
                        });
                        return o;
                    });
                    return { header, rows };
                }

                return { header: [], rows: [] };
            };

            let unifiedHeader = null;
            const sumMap = new Map();

            for (const daySnap of dailyLatest) {
                const { header, rows: snapRows } = parseSnapshot(daySnap);
                if (!unifiedHeader) unifiedHeader = header;
                for (const row of snapRows) {
                    const proje = (row["PROJE_ADI"] || "").trim();
                    if (!proje) continue;
                    if (!sumMap.has(proje)) {
                        const base = {};
                        unifiedHeader.forEach((k) => (base[k] = 0));
                        base["PROJE_ADI"] = proje;
                        sumMap.set(proje, base);
                    }
                    const acc = sumMap.get(proje);
                    unifiedHeader.forEach((k) => {
                        if (k === "PROJE_ADI") return;
                        const v = parseFloat(row[k]);
                        if (numericCols.has(k)) acc[k] = (acc[k] || 0) + (isNaN(v) ? 0 : v);
                        else if (acc[k] === 0 || acc[k] === undefined || acc[k] === null) acc[k] = row[k];
                    });
                }
            }

            const summedRows = Array.from(sumMap.values());
            if (!unifiedHeader) unifiedHeader = [];
            setRawEtablo([unifiedHeader, ...summedRows]);
        } catch (e) {
            setError("E-tablo verisi alınamadı. Daha sonra tekrar deneyin.");
            setRawEtablo([]);
        }
    }, []);

    const fetchOdakDataForRange = useCallback(async (startStr, endStr) => {
        try {
            setError("");
            const wideStart = addDays(startStr, -2);
            const wideEnd = addDays(endStr, 2);
            const payload = {
                startDate: `${wideStart}T00:00:00`,
                endDate: `${wideEnd}T23:59:59`,
                userId: 1,
            };

            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/odak`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.REACT_APP_ODAK_API_KEY}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                setOdakData([]);
                setOdakDataRaw([]);
                return;
            }

            const result = await response.json().catch(() => null);
            if (!result || !Array.isArray(result.Data)) {
                setOdakData([]);
                setOdakDataRaw([]);
                return;
            }

            const items = result.Data;
            const filteredItems = items.filter((item) => {
                const pickupDate = item.PickupDate?.split("T")[0];
                const req = item.TMSVehicleRequestDocumentNo;
                return (
                    pickupDate &&
                    pickupDate >= startStr &&
                    pickupDate <= endStr &&
                    item.OrderStatu !== 200 &&
                    req &&
                    !req.startsWith("BOS") &&
                    item.ProjectName
                );
            });

            const projectMap = new Map();
            filteredItems.forEach((item) => {
                const project = normalizeProjectName(item.ProjectName?.trim() || "");
                const reqNo = item.TMSVehicleRequestDocumentNo;
                const hasDespatch = item.TMSDespatchDocumentNo && !item.TMSDespatchDocumentNo.startsWith("BOS");
                const vehicleWorking = (item?.VehicleWorkingName || "").toUpperCase();

                if (!projectMap.has(project)) {
                    projectMap.set(project, {
                        ProjectName: project,
                        talepSet: new Set(),
                        tedarikSet: new Set(),
                        spotSet: new Set(),
                        filoSet: new Set(),
                    });
                }
                const proj = projectMap.get(project);
                proj.talepSet.add(reqNo);
                if (hasDespatch) proj.tedarikSet.add(reqNo);
                if (vehicleWorking.includes("SPOT")) proj.spotSet.add(reqNo);
                else if (vehicleWorking.includes("FİLO") || vehicleWorking.includes("FILO")) proj.filoSet.add(reqNo);
            });

            const finalData = Array.from(projectMap.values()).map((p) => ({
                ProjectName: p.ProjectName,
                Talep: p.talepSet.size,
                Tedarik: p.tedarikSet.size,
                Verilemeyen: p.talepSet.size - p.tedarikSet.size,
                Spot: p.spotSet.size,
                Filo: p.filoSet.size,
            }));

            setOdakData(finalData);
            setOdakDataRaw(filteredItems);
        } catch (err) {
            setOdakData([]);
            setOdakDataRaw([]);
            setError("ODAK servisine ulaşılamadı.");
        }
    }, []);


    useEffect(() => {
        if ((!rawEtablo || rawEtablo.length === 0) && odakData && odakData.length > 0) {
            const fallback = buildTableFromOdak(odakData.filter((p) => allowedSet.has(p.ProjectName)), allowedSet);
            const header = fallback[0];
            const rows = fallback.slice(1);
            setData([header, ...rows]);
            return;
        }
        if (!rawEtablo.length) return;

        const header = rawEtablo[0];
        let rows = rawEtablo.slice(1).map((row) => ({
            ...row,
            "REEL TALEP": 0,
            "REEL TEDARIK": 0,
            "REEL VERILEMEYEN": 0,
            "REEL SPOT": 0,
            "REEL FILO": 0,
            "REEL TESISTE": 0,
            "REEL GELECEK": 0,
            "REEL YUKLENDI": 0,
        }));

        odakData.forEach((odak) => {
            for (let row of rows) {
                const projeAdi = row["PROJE_ADI"]?.trim();
                if (projeAdi === odak.ProjectName) {
                    row["REEL TALEP"] += odak.Talep ?? 0;
                    row["REEL TEDARIK"] += odak.Tedarik ?? 0;
                    row["REEL VERILEMEYEN"] += odak.Verilemeyen ?? 0;
                    row["REEL SPOT"] += odak.Spot ?? 0;
                    row["REEL FILO"] += odak.Filo ?? 0;
                }
            }
        });

        rows = rows.filter((r) => allowedSet.has((r["PROJE_ADI"] || "").trim()));
        setData([header, ...rows]);
    }, [rawEtablo, odakData, allowedSet, buildTableFromOdak]);

    const handleFilter = useCallback(async () => {
        setLoading(true);
        setModalOpen(false);
        setSelectedRecords([]);
        try {
            await Promise.all([fetchSupabaseDailySum(startDate, endDate), fetchOdakDataForRange(startDate, endDate)]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, fetchSupabaseDailySum, fetchOdakDataForRange]);

    useEffect(() => {
        handleFilter();
    }, []);

    const columnsRendered = useMemo(() => columns, [columns]);

    // --- Render helpers ---
    const renderCell = (row, col, groupIdx, groupRows) => {
        let value = row[col];
        let displayValue = value;
        let style = {};

        if (col === "PROJE_ADI") {
            return (
                <td
                    className="cell--project"
                    onClick={() => {
                        const name = row["PROJE_ADI"]?.trim();
                        const normalized = normalizeProjectName(name);
                        setSelectedProject(name);
                        const detaylar = odakDataRaw.filter(
                            (item) => normalizeProjectName(item.ProjectName?.trim() || "") === normalized
                        );
                        setSelectedRecords(detaylar);
                        setModalOpen(true);
                    }}
                    title="Detayları görmek için tıkla"
                >
                    {row[col]}
                </td>
            );
        }

        if (col === "TOP_HEDEF_NAVLUN") {
            const parsed = parseFloat(value);
            displayValue = !isNaN(parsed) ? `${toTR(parsed)} ₺` : "0 ₺";
            style = { color: "var(--ink-900)" };
        }

        if (["HEDEF", "HEDEF_USTU", "HEDEF_ALTI"].includes(col)) {
            const parsed = parseFloat(value);
            displayValue = !isNaN(parsed) ? `${toTR(parsed)} ₺` : "0 ₺";
            if (isNaN(parsed) || parsed === 0) style = { color: "var(--ink-900)" };
            else if (parsed < 0) style = { color: "var(--red-600)", fontWeight: 700 };
            else style = { color: "var(--green-700)", fontWeight: 700 };
        } else if (["TOP_NAVLUN", "GELIR"].includes(col)) {
            const parsed = parseFloat(value);
            displayValue = !isNaN(parsed) ? `${toTR(parsed)} ₺` : "0 ₺";
            style = { color: "var(--ink-900)" };
        } else if (["SEFER_USTU", "SEFER_ALTI", "SEFER_HEDEF", "HEDEFSIZ_SEFER"].includes(col)) {
            const parsed = parseFloat(value);
            displayValue = !isNaN(parsed) ? toTR(parsed) : 0;
        } else if (col === "TED_YUZDE") {
            const parsed = parseFloat(value);
            if (!isNaN(parsed)) {
                const percentage = Math.round(parsed * 100);
                if (percentage === 0) {
                    displayValue = "-";
                    style = { color: "var(--ink-900)", fontWeight: 700 };
                } else {
                    displayValue = `%${percentage}`;
                    style = {
                        color: percentage < 70 ? "var(--red-600)" : percentage < 90 ? "var(--amber-600)" : "var(--green-700)",
                        fontWeight: 700,
                    };
                }
            }
        } else if (col === "UYUM") {
            const reelTedarik = parseFloat(row["REEL TEDARIK"]) || 0;
            const reelTalep = parseFloat(row["REEL TALEP"]) || 0;
            const uyumRatio = reelTalep > 0 ? reelTedarik / reelTalep : 0;
            const percentage = Math.round(uyumRatio * 100);
            if (percentage === 0) {
                displayValue = "-";
                style = { color: "var(--ink-900)", fontWeight: 700 };
            } else {
                displayValue = `%${percentage}`;
                style = {
                    color: percentage < 70 ? "var(--red-600)" : percentage < 90 ? "var(--amber-600)" : "var(--green-700)",
                    fontWeight: 700,
                };
            }
        } else if (col === "TOP_HEDEF_NAVL_HDF_UST") {
            const val = parseFloat(row["TOP_HEDEF_NAVL_HDF_UST"]);
            const pct = !isNaN(val) ? Math.round(val * 100) : 0;
            const color = pct < 0 ? "var(--red-600)" : pct > 0 ? "var(--green-700)" : "var(--ink-900)";
            return <td style={{ color, textAlign: "center" }}>%{pct}</td>;
        }

        const isEtablo = ["TALEP", "TEDARIK", "VERILEMEYEN"].includes(col);
        const isReel = ["REEL TALEP", "REEL TEDARIK", "REEL VERILEMEYEN"].includes(col);

        if (isEtablo || isReel) {
            if (isReel && groupIdx === 0) {
                return (
                    <td rowSpan={groupRows.length} className={`cell ${isReel ? "cell--reel" : ""}`} style={style} data-col-group={colGroupOf(col)}>
                        {displayValue || 0}
                    </td>
                );
            }
            if (isEtablo) {
                return (
                    <td className={`cell ${isEtablo ? "cell--etablo" : ""}`} style={style} data-col-group={colGroupOf(col)}>
                        {displayValue || 0}
                    </td>
                );
            }
            return null;
        }

        const talep = parseFloat(row["TALEP"]) || 0;
        const reelTalep = parseFloat(row["REEL TALEP"]) || 0;
        const talep0 = new Set(["SPOT", "FILO", "TESISTE", "GELECEK", "YUKLENDI"]);
        const reel0 = new Set(["REEL SPOT", "REEL FILO", "REEL TESISTE", "REEL GELECEK", "REEL YUKLENDI"]);

        let finalDisp;
        if (talep === 0 && talep0.has(col)) finalDisp = "-";
        else if (reelTalep === 0 && reel0.has(col)) finalDisp = "-";
        else finalDisp = displayValue ?? 0;


        const isZeroLike = finalDisp === "-" || finalDisp === 0 || finalDisp === "0" || finalDisp === "0 ₺";
        const isMoney = ["TOP_NAVLUN", "TOP_HEDEF_NAVLUN", "HEDEF", "HEDEF_USTU", "HEDEF_ALTI", "GELIR"].includes(col);
        const isPct = ["TED_YUZDE", "UYUM", "TOP_HEDEF_NAVL_HDF_UST"].includes(col);

        let content = finalDisp;
        if (isMoney) {
            const num = parseFloat(String(displayValue).replace(/[^\d.-]/g, ""));
            const tone = isNaN(num) ? "" : num < 0 ? "neg" : num > 0 ? "pos" : "muted";
            content = <Pill text={displayValue} tone={tone} />;
        } else if (isPct) {
            const pct = parseInt(String(displayValue).replace(/[^\d-]/g, ""), 10) || 0;
            const tone = pct === 0 ? "muted" : pct < 70 ? "neg" : pct < 90 ? "warn" : "pos";
            content = <Pill text={displayValue} tone={tone} />;
        }

        return (
            <td className={`cell ${isZeroLike ? "cell--zero" : ""}`} style={style} data-col-group={colGroupOf(col)} title={typeof displayValue === "string" ? displayValue : undefined}>
                {content}
            </td>
        );
    };

    const totalsRow = useMemo(() => {
        if (!data.length) return null;
        const rows = data.slice(1);
        const cells = {};

        columnsRendered.forEach((col) => {
            if (col === "PROJE_ADI") return;
            if (col === "TED_YUZDE") {
                const tTalep = rows.reduce((s, r) => s + (parseFloat(r["TALEP"]) || 0), 0);
                const tTed = rows.reduce((s, r) => s + (parseFloat(r["TEDARIK"]) || 0), 0);
                const ratio = tTalep > 0 ? tTed / tTalep : 0;
                const percentage = Math.round(ratio * 100);
                const color = percentage < 70 ? "var(--red-600)" : percentage < 90 ? "var(--amber-600)" : "var(--green-700)";
                cells[col] = <td style={{ color, fontWeight: 700, textAlign: "center" }}>%{percentage}</td>;
                return;
            }
            if (col === "UYUM") {
                const rTed = rows.reduce((s, r) => s + (parseFloat(r["REEL TEDARIK"]) || 0), 0);
                const rTalep = rows.reduce((s, r) => s + (parseFloat(r["REEL TALEP"]) || 0), 0);
                const ratio = rTalep > 0 ? rTed / rTalep : 0;
                const percentage = Math.round(ratio * 100);
                const color = percentage < 70 ? "var(--red-600)" : percentage < 90 ? "var(--amber-600)" : "var(--green-700)";
                cells[col] = <td style={{ color, fontWeight: 700, textAlign: "center" }}>%{percentage}</td>;
                return;
            }
            const total = rows.reduce((sum, row) => {
                const val = parseFloat(row[col]);
                return sum + (isNaN(val) ? 0 : val);
            }, 0);

            let displayValue = toTR(total);
            let style = { fontWeight: 700, textAlign: "center" };

            if (["TOP_NAVLUN", "TOP_HEDEF_NAVLUN", "HEDEF", "HEDEF_USTU", "HEDEF_ALTI", "GELIR"].includes(col)) {
                displayValue = `${toTR(total)} ₺`;
                style.color =
                    col === "TOP_NAVLUN" || col === "GELIR"
                        ? "var(--ink-900)"
                        : total < 0
                            ? "var(--red-600)"
                            : total === 0
                                ? "var(--ink-900)"
                                : "var(--green-700)";
            }
            cells[col] = <td style={style}>{displayValue}</td>;
        });

        return (
            <tr>
                <td>
                    <strong>TOPLAM</strong>
                </td>
                {columnsRendered
                    .filter((c) => c !== "PROJE_ADI")
                    .map((c) => (
                        <React.Fragment key={`t-${c}`}>{cells[c]}</React.Fragment>
                    ))}
            </tr>
        );
    }, [columnsRendered, data]);

    // --- UI ---
    return (
        <div className="dash">
            <StyleInjector />

            <Toolbar
                region={region}
                setRegion={setRegion}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                onFilter={handleFilter}
                loading={loading}
            />

            <div className="card">
                {error && <div className="alert alert--error">{error}</div>}
                {loading && <div className="skeleton">Veriler yükleniyor…</div>}

                {!loading && data.length > 0 ? (
                    <div className="table-wrap">
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th rowSpan="3" className="sticky-col">
                                        PROJE ADI
                                    </th>
                                    <th colSpan="2">TALEP</th>
                                    <th colSpan="2">TEDARİK</th>
                                    <th colSpan="2">VERİLEMEYEN</th>
                                    <th rowSpan="3">DEVREDEN TALEP</th>
                                    <th rowSpan="3">TOPLAM TALEP</th>
                                    <th rowSpan="3">TOPLAM TEDARİK</th>
                                    <th colSpan="2">TED %</th>
                                    <th colSpan="2">SPOT</th>
                                    <th colSpan="2">FİLO</th>
                                    <th colSpan="2">TESİSTE</th>
                                    <th colSpan="2">GELECEK</th>
                                    <th colSpan="2">YÜKLENDİ</th>
                                    {isPriv && <th rowSpan="3">TOP. NAVLUN</th>}
                                    {isPriv && <th colSpan="2">HEDEF ÜSTÜ</th>}
                                    {isPriv && <th colSpan="2">HEDEF ALTI</th>}
                                    {isPriv && <th rowSpan="3">HEDEF</th>}
                                    {isPriv && <th rowSpan="3">SEFER</th>}
                                    {isPriv && <th rowSpan="3">HEDEFSİZ SEFER</th>}
                                    {isPriv && <th rowSpan="3">TOP. HDF NAVLUN</th>}
                                    {isPriv && <th rowSpan="3">HDF ÜST ORAN</th>}
                                    {isPriv && <th rowSpan="3">GELİR</th>}
                                </tr>
                                <tr>
                                    {Array(9)
                                        .fill(0)
                                        .map((_, i) => (
                                            <React.Fragment key={`sub-${i}`}>
                                                <th>E-TABLO</th>
                                                <th>REEL</th>
                                            </React.Fragment>
                                        ))}
                                    {isPriv && (
                                        <>
                                            <th>₺</th>
                                            <th>SEFER</th>
                                            <th>₺</th>
                                            <th>SEFER</th>
                                        </>
                                    )}
                                </tr>
                                <tr />
                            </thead>
                            <tbody>
                                {(() => {
                                    const renderedRows = new Set();
                                    const tableRows = data.slice(1);

                                    return tableRows.flatMap((row, idx) => {
                                        const projeAdi = row["PROJE_ADI"]?.trim();
                                        const anaProje = Object.entries(projectMergeMap).find(([_, group]) => group.includes(projeAdi))?.[0];

                                        if (anaProje && renderedRows.has(projeAdi)) return [];

                                        const groupRows = anaProje
                                            ? tableRows.filter((r) => projectMergeMap[anaProje].includes(r["PROJE_ADI"]?.trim()))
                                            : [row];

                                        groupRows.forEach((r) => renderedRows.add(r["PROJE_ADI"]?.trim()));

                                        return groupRows.map((groupRow, groupIdx) => (
                                            <tr
                                                key={`row-${groupRow["PROJE_ADI"]?.trim() || "x"}-${groupIdx}-${idx}`}
                                                className={(() => {
                                                    const reelTalep = parseFloat(groupRow["REEL TALEP"]) || 0;
                                                    const talep = parseFloat(groupRow["TALEP"]) || 0;
                                                    return reelTalep > talep ? "row--warn" : "";
                                                })()}
                                            >
                                                {columnsRendered.map((col) => renderCell(groupRow, col, groupIdx, groupRows))}
                                            </tr>
                                        ));
                                    });
                                })()}
                            </tbody>
                            <tfoot>{totalsRow}</tfoot>
                        </table>
                    </div>
                ) : (
                    !loading && <div className="empty">Kayıt bulunamadı</div>
                )}
            </div>

            <Modal open={modalOpen} title={selectedProject} onClose={() => setModalOpen(false)}>
                {selectedRecords.length === 0 ? (
                    <div className="empty">Bu proje için kayıt yok</div>
                ) : (
                    <div className="detail-list">
                        {selectedRecords.map((it) => (
                            <div key={it.TMSVehicleRequestDocumentNo} className="detail-item">
                                <div className="detail-item__title">{it.TMSVehicleRequestDocumentNo}</div>
                                <div className="detail-grid">
                                    <span>Pickup</span>
                                    <strong>{it.PickupDate?.replace("T", " ") || "-"}</strong>

                                    <span>Despatch</span>
                                    <strong>{it.TMSDespatchDocumentNo || "-"}</strong>

                                    <span>Çalışma</span>
                                    <strong>{it.VehicleWorkingName || "-"}</strong>

                                    <span>Durum</span>
                                    <strong>{it.OrderStatu}</strong>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
        </div>
    );
}


function StyleInjector() {
    return (
        <style>{`
:root{
  /* palette */
  --ink-950:#fbfdff; --ink-900:#e7ecf4; --ink-800:#cbd5e1; --ink-700:#9aa9bf; --ink-600:#7b8aa3;
  --surface-0:#050914; --surface-100:#081226; --surface-200:#0b1730; --surface-300:#0f1e3d; --surface-400:#12244a;
  --brand-300:#93c5fd; --brand-500:#60a5fa; --brand-600:#3b82f6; --brand-700:#2563eb; --brand-800:#1d4ed8;
  --cyan-500:#22d3ee; --green-500:#22c55e; --amber-500:#f59e0b; --red-500:#ef4444;

  --r: 14px;     /* radius */
  --pad: 10px;   /* cell padding */
  --font: 13.5px;
}

*{box-sizing:border-box}
html,body,#root{height:100%}
body{
  margin:0;
  background:
    radial-gradient(1000px 600px at -10% -10%, rgba(37,99,235,.20), transparent 50%),
    radial-gradient(1000px 800px at 120% 0%, rgba(34,197,94,.10), transparent 40%),
    linear-gradient(180deg, var(--surface-100), var(--surface-200));
  color:var(--ink-900);
  font:var(--font)/1.45 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",Arial;
}

/* layout */
.dash{padding:16px;max-width:100%;height:100vh;display:flex;flex-direction:column;min-height:0}
.card{
  background:linear-gradient(180deg, rgba(15,30,61,.72), rgba(12,24,48,.86));
  border:1px solid rgba(147,197,253,.18);
  border-radius:var(--r);
  box-shadow:
    0 24px 50px rgba(0,0,0,.55),
    inset 0 1px 0 rgba(255,255,255,.06);
  padding:12px;flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;
  backdrop-filter: blur(10px);
}

/* toolbar */
.toolbar{
  position:sticky;top:0;z-index:8;
  background:
    linear-gradient(180deg, rgba(10,20,40,.85), rgba(10,20,40,.55));
  border-bottom:1px solid rgba(147,197,253,.2);
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 25px rgba(0,0,0,.35);
  margin-bottom:12px
}
.toolbar-row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:10px 6px}
.region-pills{display:flex;gap:8px;flex-wrap:wrap}
.pill{
  padding:8px 12px;border-radius:999px;
  border:1px solid rgba(147,197,253,.25);
  background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.00));
  color:var(--ink-700);
  cursor:pointer;transition:transform .15s ease, box-shadow .2s ease, border-color .2s ease, color .2s ease
}
.pill:hover{transform:translateY(-1px);border-color:var(--brand-500);color:#f0f6ff;box-shadow:0 6px 14px rgba(96,165,250,.35)}
.pill--active{
  background:
    radial-gradient(120% 120% at 10% -40%, rgba(34,211,238,.22), transparent 40%),
    linear-gradient(180deg, var(--brand-600), var(--brand-700));
  color:#f8fbff;border-color:#1e40af;
  box-shadow:0 10px 28px rgba(37,99,235,.45)
}

.date-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-left:auto}
.date-controls label{display:flex;gap:6px;align-items:center;color:var(--ink-700)}
.date-controls input{
  padding:7px 9px;border:1px solid rgba(147,197,253,.22);
  border-radius:10px;background:rgba(14,28,56,.75);
  color:var(--ink-900);outline:none;
}
.date-controls input:focus{border-color:var(--brand-500);box-shadow:0 0 0 3px rgba(96,165,250,.28)}
.preset-group{display:flex;gap:6px}

.btn{
  background:
    radial-gradient(120% 160% at -20% -40%, rgba(34,211,238,.25), transparent 40%),
    linear-gradient(180deg, var(--brand-600), var(--brand-700));
  border:1px solid #1e40af;color:#f8fbff;
  padding:9px 14px;border-radius:12px;cursor:pointer;font-weight:700;
  box-shadow:0 10px 26px rgba(37,99,235,.4)
}
.btn:disabled{opacity:.6;cursor:not-allowed;box-shadow:none}
.btn--ghost{
  background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.00));
  color:var(--ink-700);border:1px solid rgba(147,197,253,.22)
}
.btn--ghost:hover{border-color:var(--brand-500);color:#f0f6ff}
.icon-btn{background:transparent;border:1px solid rgba(147,197,253,.22);color:var(--ink-700);border-radius:10px;padding:6px 8px;cursor:pointer}
.icon-btn:hover{border-color:var(--brand-500);color:#f0f6ff}

/* alerts */
.alert{border-radius:12px;padding:10px 12px;margin:8px 0}
.alert--error{
  background:linear-gradient(180deg, rgba(239,68,68,.14), rgba(239,68,68,.08));
  color:#ffd7d7;border:1px solid rgba(239,68,68,.35)
}
.skeleton{padding:22px;border:1px dashed rgba(147,197,253,.28);border-radius:12px;color:var(--ink-700);text-align:center}
.empty{padding:28px;text-align:center;color:var(--ink-700)}

/* table wrapper */
.table-wrap{
  flex:1;min-height:0;overflow:auto;
  border-radius:16px;
  border:1px solid rgba(147,197,253,.22);
  background:
    radial-gradient(160% 120% at 120% -30%, rgba(96,165,250,.10), transparent 40%),
    linear-gradient(180deg, rgba(12,24,48,.78), rgba(10,22,44,.92));
  max-height:min(66vh,820px);
  -webkit-overflow-scrolling:touch; overscroll-behavior:contain;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06)
}
/* scrollbars */
.table-wrap::-webkit-scrollbar{height:12px;width:12px}
.table-wrap::-webkit-scrollbar-thumb{
  background:linear-gradient(180deg, rgba(147,197,253,.42), rgba(147,197,253,.26));
  border-radius:999px;border:2px solid rgba(12,24,48,.6)
}
.table-wrap::-webkit-scrollbar-track{background:transparent}

/* table core */
.tbl{
  width:max(1760px,132%);
  min-width:1480px;
  border-collapse:separate;border-spacing:0;
  table-layout:auto;
  font-size:clamp(12px,0.9vw,13.5px)
}

/* head */
.tbl thead th{
  position:sticky;top:0;z-index:3;
  background:
    linear-gradient(180deg, rgba(17,30,62,.96), rgba(17,30,62,.88)),
    linear-gradient(90deg, rgba(34,211,238,.16), transparent 40%, transparent 60%, rgba(96,165,250,.16));
  border-bottom:1px solid rgba(147,197,253,.26);
  color:#e9f1ff;text-shadow:0 1px 0 rgba(0,0,0,.45);
  font-size:12px;letter-spacing:.05em;text-transform:uppercase;
  padding:9px 10px
}

/* cells */
.tbl th,.tbl td{
  padding:var(--pad);
  border-bottom:1px solid rgba(147,197,253,.16);
  white-space:normal;word-break:break-word;overflow:hidden;text-overflow:ellipsis;
  font-size:clamp(11.5px,0.85vw,13px); line-height:1.16; text-align:right;
  font-variant-numeric:tabular-nums; font-feature-settings:'tnum' 1;
  transition:background .15s ease, color .15s ease;
}
/* subtle grid + hover glow */
.tbl tbody tr:nth-child(odd){background:rgba(255,255,255,.02)}
.tbl tbody tr:hover{
  background:
    radial-gradient(1200px 200px at 20% 50%, rgba(96,165,250,.12), transparent 60%),
    linear-gradient(90deg, rgba(96,165,250,.08), rgba(96,165,250,.03));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05)
}

/* sticky first col */
.sticky-col{position:sticky;left:0;z-index:4;min-width:228px;max-width:300px}
.cell--project{
  font-weight:650;color:#dbe8ff;cursor:pointer;text-align:left;position:sticky;left:0;background:inherit;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:14px;letter-spacing:.01em
}
.cell--project:hover{color:#ffffff;text-decoration:underline}

/* paired columns */
.cell--reel{background:rgba(34,211,238,.06)}
.cell--etablo{background:transparent; box-shadow: inset -1px 0 0 rgba(147,197,253,.18)}

/* banding by group (okunabilirlik) */
[data-col-group="TALEP"]       { background: linear-gradient(180deg, rgba(34,211,238,.05), transparent); }
[data-col-group="TEDARIK"]     { background: linear-gradient(180deg, rgba(34,197,94,.05), transparent); }
[data-col-group="VERILEMEYEN"] { background: linear-gradient(180deg, rgba(239,68,68,.05), transparent); }
[data-col-group="SPOT"],
[data-col-group="FILO"],
[data-col-group="TESISTE"],
[data-col-group="GELECEK"],
[data-col-group="YUKLENDI"]    { background: linear-gradient(180deg, rgba(147,197,253,.06), transparent); }
[data-col-group="MONEY"]       { background: linear-gradient(180deg, rgba(147,197,253,.08), transparent); }
[data-col-group="PCT"]         { background: linear-gradient(180deg, rgba(96,165,250,.08), transparent); }

/* value emphasis */
.pct-good{color:var(--green-500);font-weight:700}
.pct-mid{color:var(--amber-500);font-weight:700}
.pct-bad{color:var(--red-500);font-weight:700}
.money{color:#eaf2ff;font-weight:600}
.muted{color:var(--ink-700);opacity:.8}

/* row attention */
.row--warn{
  background:
    linear-gradient(90deg, rgba(245,158,11,.16), rgba(245,158,11,.06));
  box-shadow: inset 0 1px 0 rgba(245,158,11,.28)
}

/* modal */
.modal{position:fixed;inset:0;display:grid;place-items:center}
.modal__scrim{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(3px)}
.modal__card{
  position:relative;z-index:1;background:linear-gradient(180deg, rgba(15,30,61,.96), rgba(15,30,61,.90));
  border:1px solid rgba(147,197,253,.28);border-radius:16px;
  box-shadow:0 24px 60px rgba(0,0,0,.6);width:min(900px,92vw);
  max-height:80vh;display:flex;flex-direction:column
}
.modal__header{display:flex;justify-content:space-between;align-items:center;padding:14px;border-bottom:1px solid rgba(147,197,253,.2)}
.modal__body{padding:14px;overflow:auto}
.detail-list{display:grid;gap:12px}
.detail-item{border:1px solid rgba(147,197,253,.22);border-radius:12px;padding:12px;background:rgba(12,24,48,.85)}
.detail-item__title{font-weight:700;color:#e6efff;margin-bottom:6px}
.detail-grid{display:grid;grid-template-columns:120px 1fr;row-gap:6px;color:var(--ink-700)}

input,button{font-size:var(--font)}
`}</style>
    );
}
