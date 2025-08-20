import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import OdakDetailModal from "./components/OdakDetailModal";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ALLOWED_PROJECTS = new Set([
    "BUNGE LÜLEBURGAZ FTL",
    "BUNGE GEBZE FTL",
    "BUNGE PALET",
    "REKA FTL", "EKSUN GIDA FTL", "SARUHAN FTL",
    "PEPSİ FTL", "MUTLU MAKARNA SPOT FTL", "TEKİRDAĞ UN FTL", "AYDINLI MODA FTL",
    "ADKOTURK FTL", "ADKOTURK FTL ENERJİ İÇECEĞİ", "SGS FTL", "BSH FTL",
    "ALTERNA GIDA FTL", "DERYA OFİS FTL", "SAPRO FTL", "MARMARA CAM FTL",
    "FAKİR FTL", "MODERN KARTON FTL", "KÜÇÜKBAY FTL"
]);

const projectMergeMap = {
    "MODERN KARTON FTL": ["MODERN KARTON-PACKON", "MODERN KARTON-NİŞASTA"]
};

function Dashboard() {
    // kullanıcı & kolon yetkisi
    const userObj = JSON.parse(localStorage.getItem("kullanici") || "{}");
    const user = (userObj.kullanici || "").trim().toUpperCase();
    const isPriv = ["ONUR KEREM ÖZTÜRK", "TAHSİN BENLİ", "ATAKAN AKALIN"].includes(user);

    // --- başlık/anahtar normalizasyonu ---
    const mapHeaderKey = (k) => {
        if (!k) return k;
        const s = String(k).trim();
        const dict = {
            "PROJE ADI": "PROJE_ADI",
            "TALEP": "TALEP",
            "TEDARİK": "TEDARIK",
            "VERİLEMEYEN": "VERILEMEYEN",
            "SPOT": "SPOT",
            "FİLO": "FILO",
            "TESİSTE": "TESISTE",
            "GELECEK": "GELECEK",
            "YÜKLENDİ": "YUKLENDI",
            "TOP. NAVLUN": "TOP_NAVLUN",
            "HEDEF ÜSTÜ": "HEDEF_USTU",
            "HEDEF ALTI": "HEDEF_ALTI",
            "HEDEFSİZ SEFER": "HEDEFSIZ_SEFER",
            "GELİR": "GELIR",
            "TED. %": "TED_YUZDE",
            "SEFER_ÜSTÜ": "SEFER_USTU",
            "SEFER_ALTI": "SEFER_ALTI",
            "SEFER_HEDEF": "SEFER_HEDEF",
            "DEVREDEN TALEP": "DEVREDEN_TALEP",
            "TOPLAM TALEP": "TOPLAM_TALEP",
            "TOPLAM TEDARİK": "TOPLAM_TEDARIK",
            "TOP_HEDEF_NAVLUN": "TOP_HEDEF_NAVLUN",
            "TOP HEDEF NAVLUN": "TOP_HEDEF_NAVLUN",
            "TOP. HEDEF NAVLUN": "TOP_HEDEF_NAVLUN",
            "TOP_HEDEF_NAVL_HDF_UST": "TOP_HEDEF_NAVL_HDF_UST",
            "TOP HEDEF NAVL HDF UST": "TOP_HEDEF_NAVL_HDF_UST",
            "TOP. HEDEF NAVL HDF UST": "TOP_HEDEF_NAVL_HDF_UST",
        };
        return dict[s] || s;
    };

    // --- kolon sırası / yetki ---
    const columnOrder = [
        "PROJE_ADI",

        "TALEP", "REEL TALEP",
        "TEDARIK", "REEL TEDARIK",
        "VERILEMEYEN", "REEL VERILEMEYEN",

        "DEVREDEN_TALEP",
        "TOPLAM_TALEP",
        "TOPLAM_TEDARIK",

        "TED_YUZDE", "UYUM",

        "SPOT", "REEL SPOT",
        "FILO", "REEL FILO",
        "TESISTE", "REEL TESISTE",
        "GELECEK", "REEL GELECEK",
        "YUKLENDI", "REEL YUKLENDI",

        ...(isPriv ? [
            // <thead>’deki sıraya birebir uyuyor:
            "TOP_NAVLUN",
            "HEDEF_USTU", "SEFER_USTU",
            "HEDEF_ALTI", "SEFER_ALTI",
            "HEDEF",
            "SEFER_HEDEF",
            "HEDEFSIZ_SEFER",
            "TOP_HEDEF_NAVLUN",
            "TOP_HEDEF_NAVL_HDF_UST",
            "GELIR"
        ] : [])
    ];

    // gizli kolonlar (normalize edilmiş anahtarlar ile!)
    const HIDDEN_COLUMNS = [
        "TOP_NAVLUN", "HEDEF_USTU", "SEFER_USTU",
        "HEDEF_ALTI", "SEFER_ALTI", "SEFER_HEDEF",
        "HEDEFSIZ_SEFER", "GELIR", "TOP_HEDEF_NAVLUN", "TOP_HEDEF_NAVL_HDF_UST"
    ];
    const columns = isPriv ? columnOrder : columnOrder.filter(c => !HIDDEN_COLUMNS.includes(c));

    // --- STATE ---
    const [data, setData] = useState([]);               // e-tablo + reel eklenmiş tablo
    const [rawEtablo, setRawEtablo] = useState([]);     // ham e-tablo snapshot (normalize edilmiş header + satırlar)
    const [odakData, setOdakData] = useState([]);       // projeye göre reel özet
    const [odakDataRaw, setOdakDataRaw] = useState([]); // modal ham kayıtlar (seçili aralık)
    const [uyumsuzProjeler, setUyumsuzProjeler] = useState([]);
    const [uyumsuzKapandi, setUyumsuzKapandi] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState("");
    const [selectedRecords, setSelectedRecords] = useState([]);
    const [loading, setLoading] = useState(false);

    // Tarih aralığı (varsayılan: bugün)
    const todayStr = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);

    // ---- yardımcılar ----
    const normalizeProjectName = (name) => {
        const map = {
            "BUNGE DİLOVASI-REYSAŞ": "BUNGE GEBZE FTL",
            "BUNGE PALET": "BUNGE PALET",
            "BUNGE LÜLEBURGAZ FTL": "BUNGE LÜLEBURGAZ FTL",
        };
        return map[name] || name;
    };
    const addDays = (dateStr, delta) => {
        const d = new Date(dateStr + "T00:00:00");
        d.setDate(d.getDate() + delta);
        return d.toISOString().split("T")[0];
    };

    // ---------- SUPABASE: "başlangıç 00:00’dan önceki son snapshot" ----------
    // HER GÜNÜN 23:59:59'a kadarki SON snapshot'ını al, sonra E-tablo değerlerini TOPLA
    async function fetchSupabaseDailySum(startStr, endStr) {
        try {
            // --- 0) UTC/Istanbul farkı için sorgu penceresini ±1 gün genişlet ---
            const pad = (d, n) => String(d).padStart(n, "0");
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

            if (error) {
                console.error("Supabase (range) hatası:", error);
                setRawEtablo([]); setData([]); return;
            }
            if (!rows || rows.length === 0) { setRawEtablo([]); setData([]); return; }

            // --- 1) Gün sonu snapshot seçimi (Europe/Istanbul) ---
            const fmt = new Intl.DateTimeFormat("tr-TR", {
                timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
            });
            const dayKey = iso => {
                const d = new Date(iso);
                const [g, a, y] = fmt.format(d).split(".");
                return `${y}-${a}-${g}`;
            };
            const lastOfDay = new Map();
            for (const r of rows) lastOfDay.set(dayKey(r.created_at), r);

            const dailyLatest = Array.from(lastOfDay.entries())
                .filter(([gun]) => gun >= startStr && gun <= endStr)
                .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
                .map(([, r]) => r);

            if (dailyLatest.length === 0) { setRawEtablo([]); setData([]); return; }

            // --- 2) Gün snapshot'larını toplayacağız; önce kolon adlarını ve satırları çıkaran yardımcılar ---
            const numericCols = new Set([
                "TALEP", "TEDARIK", "VERILEMEYEN", "SPOT", "FILO", "TESISTE", "GELECEK", "YUKLENDI",
                "DEVREDEN_TALEP", "TOPLAM_TALEP", "TOPLAM_TEDARIK",
                "TOP_NAVLUN", "HEDEF_USTU", "SEFER_USTU", "HEDEF_ALTI", "SEFER_ALTI", "HEDEF", "SEFER_HEDEF",
                "HEDEFSIZ_SEFER", "GELIR", "TOP_HEDEF_NAVLUN", "TOP_HEDEF_NAVL_HDF_UST"
            ]);

            // Eski formatı (e-tablo) SEFER başlıklarını çözüp normalize eder
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
                return header.map(mapHeaderKey); // "PROJE ADI" -> "PROJE_ADI" vb.
            };

            // Bir snapshot içindeki veriyi (eski ya da yeni format) -> {header[], rows[]} döndürür
            const parseSnapshot = (snap) => {
                const jd = snap.json_data;

                // 2.a) Yeni format (objeler) – iki olası şekil:
                //      - { body: [ { PROJE_ADI:..., TALEP:... }, ... ] }
                //      - [ { PROJE_ADI:..., TALEP:... }, ... ]
                if (jd && Array.isArray(jd.body) && jd.body.length && typeof jd.body[0] === "object") {
                    const body = jd.body;
                    const rawHeader = Object.keys(body[0]);
                    const header = rawHeader.map(mapHeaderKey);
                    const rows = body.map(obj => {
                        const o = {};
                        for (const k of rawHeader) o[mapHeaderKey(k)] = obj[k];
                        return o;
                    });
                    return { header, rows };
                }
                if (Array.isArray(jd) && jd.length && typeof jd[0] === "object" && !jd[0].json_data) {
                    // doğrudan obje listesi
                    const rawHeader = Object.keys(jd[0]);
                    const header = rawHeader.map(mapHeaderKey);
                    const rows = jd.map(obj => {
                        const o = {};
                        for (const k of rawHeader) o[mapHeaderKey(k)] = obj[k];
                        return o;
                    });
                    return { header, rows };
                }

                // 2.b) Eski format: [{json_data:[H1,H2,...]}, {json_data:[v1,v2,...]}, ...]
                const headerOld = jd?.[0]?.json_data || [];
                const header = normalizeHeaderRow(headerOld);
                const rows = (jd || []).slice(1).map(r => {
                    const arr = r.json_data || [];
                    const o = {};
                    header.forEach((h, i) => { o[h] = arr[i]; });
                    return o;
                });
                return { header, rows };
            };

            // --- 3) Tüm günlerin son snapshot'larını proje bazında topla ---
            let unifiedHeader = null;
            const sumMap = new Map(); // proje -> toplam objesi

            for (const daySnap of dailyLatest) {
                const { header, rows: snapRows } = parseSnapshot(daySnap);
                if (!unifiedHeader) unifiedHeader = header;

                for (const row of snapRows) {
                    const proje = (row["PROJE_ADI"] || "").trim();
                    if (!proje) continue;

                    if (!sumMap.has(proje)) {
                        const base = {};
                        unifiedHeader.forEach(k => base[k] = 0);
                        base["PROJE_ADI"] = proje;
                        sumMap.set(proje, base);
                    }
                    const acc = sumMap.get(proje);

                    unifiedHeader.forEach(k => {
                        if (k === "PROJE_ADI") return;
                        const v = parseFloat(row[k]);
                        if (numericCols.has(k)) acc[k] = (acc[k] || 0) + (isNaN(v) ? 0 : v);
                        else if (acc[k] === 0 || acc[k] === undefined || acc[k] === null) acc[k] = row[k];
                    });
                }
            }

            const summedRows = Array.from(sumMap.values());
            if (!unifiedHeader) unifiedHeader = []; // emniyet
            setRawEtablo([unifiedHeader, ...summedRows]);
        } catch (e) {
            console.error("E-tablo (daily sum) hata:", e);
            setRawEtablo([]); setData([]);
        }
    

        // İsteğe bağlı: tek snapshot normalizasyonu (kullanılmıyor ama dursun)
        function normalizeAndSet(jsonDataArray) {
            const rawHeader = jsonDataArray[0]?.json_data || [];
            let headerRow = [...rawHeader];
            let seferCounter = 1;
            for (let i = 0; i < headerRow.length; i++) {
                if (headerRow[i] === "SEFER") {
                    const prev = headerRow[i - 1];
                    if (prev === "HEDEF ÜSTÜ") headerRow[i] = "SEFER_ÜSTÜ";
                    else if (prev === "HEDEF ALTI") headerRow[i] = "SEFER_ALTI";
                    else if (prev === "HEDEF") headerRow[i] = "SEFER_HEDEF";
                    else headerRow[i] = `SEFER_${seferCounter++}`;
                }
            }
            headerRow = headerRow.map(mapHeaderKey);

            const bodyRows = jsonDataArray.slice(1).map(row => row.json_data);
            const formatted = [headerRow, ...bodyRows.map(row => {
                const obj = {};
                headerRow.forEach((key, i) => { obj[key] = row[i]; });
                return obj;
            })];

            setRawEtablo(formatted);
        }
    }

    // ---------- ODAK: ±2 gün pencereden çek, sayımı seçili aralığa göre yap ----------
    async function fetchOdakDataForRange(startStr, endStr) {
        const wideStart = addDays(startStr, -2);
        const wideEnd = addDays(endStr, 2);

        const payload = {
            startDate: `${wideStart}T00:00:00`,
            endDate: `${wideEnd}T23:59:59`,
            userId: 1,
        };

        try {
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/odak`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: process.env.ODAK_API_KEY
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            const items = Array.isArray(result.Data) ? result.Data : [];

            // sadece seçili aralık
            const filteredItems = items.filter((item) => {
                const pickupDate = item.PickupDate?.split("T")[0];
                const req = item.TMSVehicleRequestDocumentNo;
                return (
                    pickupDate &&
                    pickupDate >= startStr && pickupDate <= endStr &&
                    item.OrderStatu !== 200 &&
                    req && !req.startsWith("BOS") &&
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

            setOdakData(finalData.filter(p => ALLOWED_PROJECTS.has(p.ProjectName)));
            setOdakDataRaw(filteredItems);
        } catch (err) {
            console.error("Odak API hatası:", err);
            setOdakData([]);
            setOdakDataRaw([]);
        }
    }

    // ---------- Birleştirme: e-tablo snapshot + ODAK reel ----------
    useEffect(() => {
        if (!rawEtablo.length) return;

        const header = rawEtablo[0]; // normalize edilmiş header anahtarları
        const rows = rawEtablo.slice(1).map((row) => ({
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

        const uyumsuzlar = rows.filter(row => {
            const talep = parseFloat(row["TALEP"]);
            const reelTalep = parseFloat(row["REEL TALEP"]);
            const uyumOrani = talep > 0 ? reelTalep / talep : 0;
            return talep > 0 && uyumOrani < 1;
        }).map(row => ({
            proje: row["PROJE_ADI"],
            uyum: Math.round(((parseFloat(row["REEL TALEP"]) || 0) / (parseFloat(row["TALEP"]) || 1)) * 100)
        }));

        setUyumsuzProjeler(uyumsuzlar);
        setData([header, ...rows]);
    }, [rawEtablo, odakData]);

    // ---------- Filtre butonu ----------
    const handleFilter = async () => {
        setLoading(true);
        setModalOpen(false);
        setSelectedRecords([]);
        setUyumsuzKapandi(false);

        try {
            await Promise.all([
                fetchSupabaseDailySum(startDate, endDate),
                fetchOdakDataForRange(startDate, endDate),
            ]);
        } finally {
            setLoading(false);
        }
    };

    // ---------- ilk yüklemede (bugün-bugün) getir ----------
    useEffect(() => {
        handleFilter();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="app-container">
            {/* Tarih filtre UI (tek) */}
            <div className="filter-bar" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <div>
                    <label style={{ fontWeight: 600, marginRight: 8 }}>Başlangıç</label>
                    <input
                        type="date"
                        value={startDate}
                        max={endDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div>
                    <label style={{ fontWeight: 600, marginRight: 8 }}>Bitiş</label>
                    <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
                <button
                    onClick={handleFilter}
                    className="btn-primary"
                    disabled={loading}
                    style={{ padding: "8px 16px", fontWeight: 700, cursor: "pointer" }}
                >
                    {loading ? "Filtreleniyor..." : "Filtrele"}
                </button>
                <small style={{ opacity: 0.7 }}>
                </small>
            </div>

            <div className="section">
                {uyumsuzProjeler.length > 0 && (
                    <div className="uyari-modal">
                        <button
                            className="modal-close"
                            onClick={() => {
                                setUyumsuzProjeler([]);
                                setUyumsuzKapandi(true);
                            }}
                        >
                            ×
                        </button>
                        <h4>⚠️ Uyum oranı %100’den düşük olan projeler</h4>
                        <ul>
                            {uyumsuzProjeler.map((item, i) => (
                                <li key={i}>
                                    <strong>{item.proje}</strong> — Uyum: <span style={{ color: "#e74c3c", fontWeight: "bold" }}>%{item.uyum}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {data.length > 0 ? (
                    <div className="table-wrapper">
                        <table className="styled-table">
                            <thead>
                                <tr>
                                    <th rowSpan="3">PROJE ADI</th>

                                    <th colSpan="2">TALEP</th>
                                    <th colSpan="2">TEDARİK</th>
                                    <th colSpan="2">VERİLEMEYEN</th>

                                    {/* ▼ TEK SÜTUNLAR */}
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
                                    {/* TALEP, TEDARİK, VERİLEMEYEN, TED %, SPOT, FİLO, TESİSTE, GELECEK, YÜKLENDİ */}
                                    {Array(9).fill().map((_, i) => (
                                        <React.Fragment key={i}>
                                            <th>E-TABLO</th>
                                            <th>REEL</th>
                                        </React.Fragment>
                                    ))}
                                    {isPriv && (<><th>₺</th><th>SEFER</th><th>₺</th><th>SEFER</th></>)}
                                </tr>

                                <tr></tr>
                            </thead>

                            <tbody>
                                {(() => {
                                    const renderedRows = new Set();
                                    const tableRows = data.slice(1);

                                    return tableRows.flatMap((row) => {
                                        const projeAdi = row["PROJE_ADI"]?.trim();
                                        const anaProje = Object.entries(projectMergeMap).find(([_, group]) =>
                                            group.includes(projeAdi)
                                        )?.[0];

                                        if (anaProje && renderedRows.has(projeAdi)) return [];

                                        const groupRows = anaProje
                                            ? tableRows.filter((r) => projectMergeMap[anaProje].includes(r["PROJE_ADI"]?.trim()))
                                            : [row];

                                        groupRows.forEach((r) => renderedRows.add(r["PROJE_ADI"]?.trim()));

                                        return groupRows.map((groupRow, groupIdx) => (
                                            <tr
                                                key={`row-${groupRow["PROJE_ADI"]?.trim() || "bilinmiyor"}-${groupIdx}`}
                                                className={(() => {
                                                    const proje = groupRow["PROJE_ADI"]?.trim();
                                                    const reelTalep = parseFloat(groupRow["REEL TALEP"]) || 0;
                                                    const talep = parseFloat(groupRow["TALEP"]) || 0;
                                                    if (reelTalep > talep) return "fazla-reel-talep";
                                                    if (uyumsuzKapandi && uyumsuzProjeler.find(p => p.proje === proje)) return "uyumsuz-satir";
                                                    return "";
                                                })()}
                                            >
                                                {columns.map((col, colIdx) => {
                                                    let value = groupRow[col];
                                                    let style = {};
                                                    let displayValue = value;

                                                    if (col === "PROJE_ADI") {
                                                        return (
                                                            <td
                                                                key={colIdx}
                                                                className="clickable-project"
                                                                style={{ fontWeight: "bold", cursor: "pointer", color: "#2980b9" }}
                                                                onClick={() => {
                                                                    const name = groupRow["PROJE_ADI"]?.trim();
                                                                    const normalized = normalizeProjectName(name);
                                                                    setSelectedProject(name);
                                                                    const detaylar = odakDataRaw.filter(item =>
                                                                        normalizeProjectName(item.ProjectName?.trim() || "") === normalized
                                                                    );
                                                                    setSelectedRecords(detaylar);
                                                                    setModalOpen(true);
                                                                }}
                                                            >
                                                                {groupRow[col]}
                                                            </td>
                                                        );
                                                    }
                                                    if (col === "TOP_HEDEF_NAVLUN") {
                                                        const parsed = parseFloat(value);
                                                        displayValue = !isNaN(parsed) ? `${parsed.toLocaleString("tr-TR")} ₺` : "0 ₺";
                                                        style = { color: "#000" };
                                                    }


                                                    // ₺ biçimlendirme
                                                    if (["HEDEF", "HEDEF_USTU", "HEDEF_ALTI"].includes(col)) {
                                                        const parsed = parseFloat(value);
                                                        displayValue = !isNaN(parsed) ? `${parsed.toLocaleString("tr-TR")} ₺` : "0 ₺";
                                                        if (isNaN(parsed) || parsed === 0) style = { color: "#000" };
                                                        else if (parsed < 0) style = { color: "#e74c3c", fontWeight: "bold" };
                                                        else style = { color: "#1e8449", fontWeight: "bold" };
                                                    } else if (col === "TOP_NAVLUN" || col === "GELIR") {
                                                        const parsed = parseFloat(value);
                                                        displayValue = !isNaN(parsed) ? `${parsed.toLocaleString("tr-TR")} ₺` : "0 ₺";
                                                        style = { color: "#000" };
                                                    } else if (["SEFER_USTU", "SEFER_ALTI", "SEFER_HEDEF", "HEDEFSIZ_SEFER"].includes(col)) {
                                                        const parsed = parseFloat(value);
                                                        displayValue = !isNaN(parsed) ? parsed.toLocaleString("tr-TR") : 0;
                                                    } else if (col === "TED_YUZDE") {
                                                        const parsed = parseFloat(value);
                                                        if (!isNaN(parsed)) {
                                                            const percentage = Math.round(parsed * 100);
                                                            if (percentage === 0) {
                                                                displayValue = "-";
                                                                style = { color: "#000", fontWeight: "bold" };
                                                            } else {
                                                                displayValue = `%${percentage}`;
                                                                style = {
                                                                    color: percentage < 70 ? "#e74c3c" : percentage < 90 ? "#f39c12" : "#27ae60",
                                                                    fontWeight: "bold",
                                                                };
                                                            }
                                                        }
                                                    } else if (col === "UYUM") {
                                                        const reelTedarik = parseFloat(groupRow["REEL TEDARIK"]) || 0;
                                                        const reelTalep = parseFloat(groupRow["REEL TALEP"]) || 0;
                                                        const uyumRatio = reelTalep > 0 ? reelTedarik / reelTalep : 0;
                                                        const percentage = Math.round(uyumRatio * 100);
                                                        if (percentage === 0) {
                                                            displayValue = "-";
                                                            style = { color: "#000", fontWeight: "bold" };
                                                        } else {
                                                            displayValue = `%${percentage}`;
                                                            style = {
                                                                color: percentage < 70 ? "#e74c3c" : percentage < 90 ? "#f39c12" : "#27ae60",
                                                                fontWeight: "bold",
                                                            };
                                                        }

                                                    }
                                                    else if (col === "TOP_HEDEF_NAVL_HDF_UST") {
                                                        const val = parseFloat(row["TOP_HEDEF_NAVL_HDF_UST"]);
                                                        const pct = !isNaN(val) ? Math.round(val * 100) : 0;
                                                        const color = pct < 0 ? "#e74c3c" : pct > 0 ? "#27ae60" : "#000";
                                                        return <td key={colIdx} style={{ color, textAlign: "center" }}>%{pct}</td>;
                                                    }


                                                    const isEtablo = ["TALEP", "TEDARIK", "VERILEMEYEN"].includes(col);
                                                    const isReel = ["REEL TALEP", "REEL TEDARIK", "REEL VERILEMEYEN"].includes(col);
                                                    const className = isEtablo ? "etablo" : isReel ? "reel" : "";

                                                    if (isEtablo || isReel) {
                                                        if (isReel && groupIdx === 0) {
                                                            return (
                                                                <td key={colIdx} rowSpan={groupRows.length} style={style} className={className}>
                                                                    {displayValue || 0}
                                                                </td>
                                                            );
                                                        } else if (isEtablo) {
                                                            return (
                                                                <td key={colIdx} style={style} className={className}>
                                                                    {displayValue || 0}
                                                                </td>
                                                            );
                                                        } else {
                                                            return null;
                                                        }
                                                    }

                                                    const talep = parseFloat(groupRow["TALEP"]) || 0;
                                                    const reelTalep = parseFloat(groupRow["REEL TALEP"]) || 0;
                                                    const talep0Columns = new Set(["SPOT", "FILO", "TESISTE", "GELECEK", "YUKLENDI"]);
                                                    const reelTalep0Columns = new Set(["REEL SPOT", "REEL FILO", "REEL TESISTE", "REEL GELECEK", "REEL YUKLENDI"]);

                                                    let finalDisplay;
                                                    if (talep === 0 && talep0Columns.has(col)) finalDisplay = "-";
                                                    else if (reelTalep === 0 && reelTalep0Columns.has(col)) finalDisplay = "-";
                                                    else finalDisplay = displayValue ?? 0;

                                                    return (
                                                        <td key={colIdx} style={style}>
                                                            {finalDisplay}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ));
                                    });
                                })()}
                            </tbody>

                            <tfoot>
                                <tr>
                                    {columns.map((col, colIdx) => {
                                        if (col === "PROJE_ADI") {
                                            return <td key={colIdx}><strong>TOPLAM</strong></td>;
                                        }
                                        if (col === "TED_YUZDE") {
                                            const totalTalep = data.slice(1).reduce((s, r) => s + (parseFloat(r["TALEP"]) || 0), 0);
                                            const totalTedarik = data.slice(1).reduce((s, r) => s + (parseFloat(r["TEDARIK"]) || 0), 0);
                                            const ratio = totalTalep > 0 ? totalTedarik / totalTalep : 0;
                                            const percentage = Math.round(ratio * 100);
                                            const color = percentage < 70 ? "#e74c3c" : percentage < 90 ? "#f39c12" : "#27ae60";
                                            return <td key={colIdx} style={{ color, fontWeight: "bold", textAlign: "center" }}>%{percentage}</td>;
                                        }
                                        if (col === "UYUM") {
                                            const totalReelTedarik = data.slice(1).reduce((s, r) => s + (parseFloat(r["REEL TEDARIK"]) || 0), 0);
                                            const totalReelTalep = data.slice(1).reduce((s, r) => s + (parseFloat(r["REEL TALEP"]) || 0), 0);
                                            const ratio = totalReelTalep > 0 ? totalReelTedarik / totalReelTalep : 0;
                                            const percentage = Math.round(ratio * 100);
                                            const color = percentage < 70 ? "#e74c3c" : percentage < 90 ? "#f39c12" : "#27ae60";
                                            return <td key={colIdx} style={{ color, fontWeight: "bold", textAlign: "center" }}>%{percentage}</td>;
                                        }

                                        const total = data.slice(1).reduce((sum, row) => {
                                            const val = parseFloat(row[col]);
                                            return sum + (isNaN(val) ? 0 : val);
                                        }, 0);

                                        let displayValue = total.toLocaleString("tr-TR");
                                        let style = { fontWeight: "bold", textAlign: "center" };

                                        if (["TOP_NAVLUN", "TOP_HEDEF_NAVLUN", "HEDEF", "HEDEF_USTU", "HEDEF_ALTI", "GELIR"].includes(col)) {
                                            displayValue = `${total.toLocaleString("tr-TR")} ₺`;
                                            style.color = (col === "TOP_NAVLUN" || col === "GELIR")
                                                ? "#000"
                                                : total < 0 ? "#e74c3c" : total === 0 ? "#000" : "#1e8449";
                                        }

                                        return <td key={colIdx} style={style}>{displayValue}</td>;
                                    })}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : (
                    <p className="loading">{loading ? "Yükleniyor..." : "Kayıt bulunamadı"}</p>
                )}

                {modalOpen && (
                    <OdakDetailModal
                        projectName={selectedProject}
                        records={selectedRecords}
                        onClose={() => setModalOpen(false)}
                    />
                )}
            </div>
        </div>
    );
}

export default Dashboard;
