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

    const columnOrder = [
        "PROJE ADI",
        "TALEP", "REEL TALEP",
        "TEDARİK", "REEL TEDARİK",
        "VERİLEMEYEN", "REEL VERİLEMEYEN",
        "TED. %", "UYUM",
        "SPOT", "REEL SPOT",
        "FİLO", "REEL FİLO",
        "TESİSTE", "REEL TESİSTE",
        "GELECEK", "REEL GELECEK",
        "YÜKLENDİ", "REEL YÜKLENDİ",
        ...(isPriv ? [
            "TOP. NAVLUN",
            "HEDEF ÜSTÜ", "SEFER_ÜSTÜ",
            "HEDEF ALTI", "SEFER_ALTI",
            "HEDEF", "SEFER_HEDEF",
            "HEDEFSİZ SEFER",
            "GELİR"
        ] : [])
    ];
    const HIDDEN_COLUMNS = [
        "TOP. NAVLUN", "HEDEF ÜSTÜ", "SEFER_ÜSTÜ",
        "HEDEF ALTI", "SEFER_ALTI", "SEFER_HEDEF", "HEDEFSİZ SEFER",
        "GELİR"
    ];
    const columns = isPriv ? columnOrder : columnOrder.filter(c => !HIDDEN_COLUMNS.includes(c));

    // --- STATE ---
    const [data, setData] = useState([]);               // e-tablo + reel eklenmiş tablo
    const [rawEtablo, setRawEtablo] = useState([]);     // ham e-tablo snapshot
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
            // 1) Aralıktaki TÜM satırları çek (UTC depolanıyor; geniş aralık)
            const fromISO = `${startStr}T00:00:00Z`;
            const toISO = `${endStr}T23:59:59.999Z`;

            const { data: rows, error } = await supabase
                .from("toplu_sonuclar")
                .select("json_data, created_at")
                .gte("created_at", fromISO)
                .lte("created_at", toISO)
                .order("created_at", { ascending: true }); // gün içi sonu seçmek için artan

            if (error) {
                console.error("Supabase (range) hatası:", error);
                setRawEtablo([]);
                setData([]);
                return;
            }
            if (!rows || rows.length === 0) {
                setRawEtablo([]);
                setData([]);
                return;
            }

            // 2) Europe/Istanbul gününe göre grupla -> her günün SON kaydını seç
            const fmt = new Intl.DateTimeFormat("tr-TR", {
                timeZone: "Europe/Istanbul",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            });

            const dayKey = (iso) => {
                const d = new Date(iso);
                // YYYY-MM-DD üret
                const [gun, ay, yil] = fmt.format(d).split("."); // "gg.mm.yyyy"
                return `${yil}-${ay}-${gun}`;
            };

            const lastOfDay = new Map(); // gun -> row
            for (const r of rows) {
                const gun = dayKey(r.created_at);
                // artan sıralı geldiği için, aynı gün gördükçe ÜZERİNE yazar -> en SON kalır
                lastOfDay.set(gun, r);
            }

            // 3) Günlerin son snapshot'larını al
            const dailyLatest = Array.from(lastOfDay.entries())
                .filter(([gun]) => gun >= startStr && gun <= endStr)
                .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                .map(([, r]) => r);

            if (dailyLatest.length === 0) {
                setRawEtablo([]);
                setData([]);
                return;
            }

            // 4) E-tablo başlığı
            const headerRaw = dailyLatest[0].json_data?.[0]?.json_data || [];
            const headerRow = [...headerRaw];
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

            // 5) Günlerin E-tablo satırlarını PROJE bazında topla
            const sumMap = new Map(); // proje -> obj (kolon toplamları)
            const numericCols = new Set([
                "TALEP", "TEDARİK", "VERİLEMEYEN", "SPOT", "FİLO", "TESİSTE", "GELECEK", "YÜKLENDİ",
                "TOP. NAVLUN", "HEDEF ÜSTÜ", "SEFER_ÜSTÜ", "HEDEF ALTI", "SEFER_ALTI", "HEDEF", "SEFER_HEDEF", "HEDEFSİZ SEFER", "GELİR",
                // bazı tablolarında olabilir diye ek bıraktım; olmayanlar zaten NaN olarak 0 geçer
            ]);

            const pushRow = (rowArr) => {
                const obj = {};
                headerRow.forEach((key, i) => (obj[key] = rowArr[i]));
                const proje = (obj["PROJE ADI"] || "").trim();
                if (!proje) return;

                if (!sumMap.has(proje)) {
                    const base = {};
                    headerRow.forEach((k) => (base[k] = 0));
                    base["PROJE ADI"] = proje; // sabit
                    sumMap.set(proje, base);
                }
                const acc = sumMap.get(proje);

                headerRow.forEach((k) => {
                    if (k === "PROJE ADI") return;
                    const v = parseFloat(obj[k]);
                    if (numericCols.has(k)) {
                        acc[k] = (acc[k] || 0) + (isNaN(v) ? 0 : v);
                    } else {
                        // numerik olmayan kolonlar için ilk dolu değeri koru (istersen boş bırak)
                        if (acc[k] === 0 || acc[k] === undefined || acc[k] === null) acc[k] = obj[k];
                    }
                });
            };

            for (const daySnap of dailyLatest) {
                const jsonDataArray = daySnap.json_data || [];
                for (let i = 1; i < jsonDataArray.length; i++) {
                    pushRow(jsonDataArray[i].json_data);
                }
            }

            // 6) Toplam E-tablo’yu diziye çevir
            const summedRows = Array.from(sumMap.values());
            const formatted = [headerRow, ...summedRows];

            setRawEtablo(formatted); // REEL entegrasyonu ayrı effect'te yapılıyor
        } catch (e) {
            console.error("E-tablo (daily sum) hata:", e);
            setRawEtablo([]);
            setData([]);
        }
    
        function normalizeAndSet(jsonDataArray) {
            const rawHeader = jsonDataArray[0]?.json_data || [];
            const headerRow = [...rawHeader];
            let seferCounter = 1;

            // "SEFER" başlıklarını ayrıştır
            for (let i = 0; i < headerRow.length; i++) {
                if (headerRow[i] === "SEFER") {
                    const prev = headerRow[i - 1];
                    if (prev === "HEDEF ÜSTÜ") headerRow[i] = "SEFER_ÜSTÜ";
                    else if (prev === "HEDEF ALTI") headerRow[i] = "SEFER_ALTI";
                    else if (prev === "HEDEF") headerRow[i] = "SEFER_HEDEF";
                    else headerRow[i] = `SEFER_${seferCounter++}`;
                }
            }

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

        const header = rawEtablo[0];
        const rows = rawEtablo.slice(1).map((row) => ({
            ...row,
            "REEL TALEP": 0,
            "REEL TEDARİK": 0,
            "REEL VERİLEMEYEN": 0,
            "REEL SPOT": 0,
            "REEL FİLO": 0,
        }));

        odakData.forEach((odak) => {
            for (let row of rows) {
                const projeAdi = row["PROJE ADI"]?.trim();
                if (projeAdi === odak.ProjectName) {
                    row["REEL TALEP"] += odak.Talep ?? 0;
                    row["REEL TEDARİK"] += odak.Tedarik ?? 0;
                    row["REEL VERİLEMEYEN"] += odak.Verilemeyen ?? 0;
                    row["REEL SPOT"] += odak.Spot ?? 0;
                    row["REEL FİLO"] += odak.Filo ?? 0;
                }
            }
        });

        const uyumsuzlar = rows.filter(row => {
            const talep = parseFloat(row["TALEP"]);
            const reelTalep = parseFloat(row["REEL TALEP"]);
            const uyumOrani = talep > 0 ? reelTalep / talep : 0;
            return talep > 0 && uyumOrani < 1;
        }).map(row => ({
            proje: row["PROJE ADI"],
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
            // E-TABLO: aralıktaki HER GÜNÜN son snapshot'ı -> TOPLAM
            fetchSupabaseDailySum(startDate, endDate),
            // ODAK: ±2 gün pencereden çek, sayımı seçilen aralığa göre yap
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
                                    {isPriv && <th rowSpan="3">GELİR</th>}
                                </tr>
                                <tr>
                                    {Array(9).fill().map((_, i) => (
                                        <React.Fragment key={i}>
                                            <th>E-TABLO</th>
                                            <th>REEL</th>
                                        </React.Fragment>
                                    ))}
                                    {isPriv && (
                                        <>
                                            <th>₺</th><th>SEFER</th>
                                            <th>₺</th><th>SEFER</th>
                                        </>
                                    )}
                                </tr>
                                <tr></tr>
                            </thead>

                            <tbody>
                                {(() => {
                                    const renderedRows = new Set();
                                    const tableRows = data.slice(1);

                                    return tableRows.flatMap((row) => {
                                        const projeAdi = row["PROJE ADI"]?.trim();
                                        const anaProje = Object.entries(projectMergeMap).find(([_, group]) =>
                                            group.includes(projeAdi)
                                        )?.[0];

                                        if (anaProje && renderedRows.has(projeAdi)) return [];

                                        const groupRows = anaProje
                                            ? tableRows.filter((r) => projectMergeMap[anaProje].includes(r["PROJE ADI"]?.trim()))
                                            : [row];

                                        groupRows.forEach((r) => renderedRows.add(r["PROJE ADI"]?.trim()));

                                        return groupRows.map((groupRow, groupIdx) => (
                                            <tr
                                                key={`row-${groupRow["PROJE ADI"]?.trim() || "bilinmiyor"}-${groupIdx}`}
                                                className={(() => {
                                                    const proje = groupRow["PROJE ADI"]?.trim();
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

                                                    if (col === "PROJE ADI") {
                                                        return (
                                                            <td
                                                                key={colIdx}
                                                                className="clickable-project"
                                                                style={{ fontWeight: "bold", cursor: "pointer", color: "#2980b9" }}
                                                                onClick={() => {
                                                                    const name = groupRow["PROJE ADI"]?.trim();
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

                                                    // ₺ biçimlendirme
                                                    if (["HEDEF", "HEDEF ÜSTÜ", "HEDEF ALTI"].includes(col)) {
                                                        const parsed = parseFloat(value);
                                                        displayValue = !isNaN(parsed) ? `${parsed.toLocaleString("tr-TR")} ₺` : "0 ₺";
                                                        if (isNaN(parsed) || parsed === 0) style = { color: "#000" };
                                                        else if (parsed < 0) style = { color: "#e74c3c", fontWeight: "bold" };
                                                        else style = { color: "#1e8449", fontWeight: "bold" };
                                                    } else if (col === "TOP. NAVLUN" || col === "GELİR") {
                                                        const parsed = parseFloat(value);
                                                        displayValue = !isNaN(parsed) ? `${parsed.toLocaleString("tr-TR")} ₺` : "0 ₺";
                                                        style = { color: "#000" };
                                                    } else if (["SEFER_ÜSTÜ", "SEFER_ALTI", "SEFER_HEDEF", "HEDEFSİZ SEFER"].includes(col)) {
                                                        const parsed = parseFloat(value);
                                                        displayValue = !isNaN(parsed) ? parsed.toLocaleString("tr-TR") : 0;
                                                    } else if (col === "TED. %") {
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
                                                        const reelTedarik = parseFloat(groupRow["REEL TEDARİK"]) || 0;
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

                                                    const isEtablo = ["TALEP", "TEDARİK", "VERİLEMEYEN"].includes(col);
                                                    const isReel = ["REEL TALEP", "REEL TEDARİK", "REEL VERİLEMEYEN"].includes(col);
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
                                                    const talep0Columns = new Set(["SPOT", "FİLO", "TESİSTE", "GELECEK", "YÜKLENDİ"]);
                                                    const reelTalep0Columns = new Set(["REEL SPOT", "REEL FİLO", "REEL TESİSTE", "REEL GELECEK", "REEL YÜKLENDİ"]);

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
                                        if (col === "PROJE ADI") {
                                            return <td key={colIdx}><strong>TOPLAM</strong></td>;
                                        }
                                        if (col === "TED. %") {
                                            const totalTalep = data.slice(1).reduce((s, r) => s + (parseFloat(r["TALEP"]) || 0), 0);
                                            const totalTedarik = data.slice(1).reduce((s, r) => s + (parseFloat(r["TEDARİK"]) || 0), 0);
                                            const ratio = totalTalep > 0 ? totalTedarik / totalTalep : 0;
                                            const percentage = Math.round(ratio * 100);
                                            const color = percentage < 70 ? "#e74c3c" : percentage < 90 ? "#f39c12" : "#27ae60";
                                            return <td key={colIdx} style={{ color, fontWeight: "bold", textAlign: "center" }}>%{percentage}</td>;
                                        }
                                        if (col === "UYUM") {
                                            const totalReelTedarik = data.slice(1).reduce((s, r) => s + (parseFloat(r["REEL TEDARİK"]) || 0), 0);
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

                                        if (["TOP. NAVLUN", "HEDEF", "HEDEF ÜSTÜ", "HEDEF ALTI", "GELİR"].includes(col)) {
                                            displayValue = `${total.toLocaleString("tr-TR")} ₺`;
                                            style.color = (col === "TOP. NAVLUN" || col === "GELİR") ? "#000"
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
