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
    "BUNGE GEBZE FTL",        // ✅ normalize edilen ad
    "BUNGE PALET",            // ✅ normalize edilen ad
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
    // ⬇️ BUNU İLK OLARAK BURAYA YAZ
    const userObj = JSON.parse(localStorage.getItem("kullanici") || "{}");
    const user = (userObj.kullanici || "").trim().toUpperCase();
    const isOnur = user === "ONUR KEREM ÖZTÜRK";
    const isTahsin = user === "TAHSİN BENLİ";
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
        ...(isOnur || isTahsin ? [  // 👈 burada ikisini de kapsıyor
            "TOP. NAVLUN",
            "HEDEF ÜSTÜ", "SEFER_ÜSTÜ",
            "HEDEF ALTI", "SEFER_ALTI",
            "HEDEF", "SEFER_HEDEF",
            "HEDEFSİZ SEFER"
        ] : [])
    ];

    const [data, setData] = useState([]);
    const [odakData, setOdakData] = useState([]);
    const [uyumsuzProjeler, setUyumsuzProjeler] = useState([]);
    const [uyumsuzKapandi, setUyumsuzKapandi] = useState(false);
    const HIDDEN_COLUMNS = [
        "TOP. NAVLUN", "HEDEF ÜSTÜ", "SEFER_ÜSTÜ",
        "HEDEF ALTI", "SEFER_ALTI", "SEFER_HEDEF", "HEDEFSİZ SEFER"
    ];

    const visibleColumns = (isOnur || isTahsin)
        ? columnOrder
        : columnOrder.filter(col => !HIDDEN_COLUMNS.includes(col));
    const [odakDataRaw, setOdakDataRaw] = useState([]); // SPOT/FİLO analizinde kullanacağız
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState("");
    const [selectedRecords, setSelectedRecords] = useState([]);






    useEffect(() => {
        async function fetchSupabaseData() {
            const { data, error } = await supabase
                .from("toplu_sonuclar")
                .select("json_data, created_at")
                .order("created_at", { ascending: false })
                .limit(1);

            if (error) {
                console.error("Supabase veri çekme hatası:", error);
                return;
            }

            if (data && data.length > 0) {
                try {
                    const jsonDataArray = data[0].json_data;

                    const rawHeader = jsonDataArray[0]?.json_data || [];

                    // ✅ "SEFER" başlıklarını ayır
                    const headerRow = [...rawHeader];
                    let seferCounter = 1;

                    for (let i = 0; i < headerRow.length; i++) {
                        if (headerRow[i] === "SEFER") {
                            const prev = headerRow[i - 1];
                            if (prev === "HEDEF ÜSTÜ") {
                                headerRow[i] = "SEFER_ÜSTÜ";
                            } else if (prev === "HEDEF ALTI") {
                                headerRow[i] = "SEFER_ALTI";
                            } else if (prev === "HEDEF") {
                                headerRow[i] = "SEFER_HEDEF";
                            } else {
                                headerRow[i] = `SEFER_${seferCounter++}`; // fallback
                            }
                        }
                    }

                    const bodyRows = jsonDataArray.slice(1).map(row => row.json_data);

                    const formattedData = [headerRow, ...bodyRows.map(row => {
                        const obj = {};
                        headerRow.forEach((key, i) => {
                            obj[key] = row[i];
                        });
                        return obj;
                    })];

                    setData(formattedData);
                } catch (e) {
                    console.error("Veri ayrıştırma hatası:", e);
                }
            }
        }

        fetchSupabaseData();
    }, []);


    useEffect(() => {
        async function fetchOdakData() {
            const normalizeProjectName = (name) => {
                const map = {
                    "BUNGE DİLOVASI-REYSAŞ": "BUNGE GEBZE FTL",
                    "BUNGE PALET": "BUNGE PALET",
                    "BUNGE LÜLEBURGAZ FTL": "BUNGE LÜLEBURGAZ FTL",
                };
                return map[name] || name;
            };

            const today = new Date();
            const todayStr = today.toISOString().split("T")[0];

            // Geniş tarih aralığı: Bugünden 3 gün öncesine gidiyoruz, çünkü PickupDate bugünü yakalayabilsin
            const startDateObj = new Date(today);
            startDateObj.setDate(startDateObj.getDate() - 3);
            const endDateObj = new Date(today);
            endDateObj.setDate(endDateObj.getDate() + 3);

            const payload = {
                startDate: `${startDateObj.toISOString().split("T")[0]}T00:00:00`,
                endDate: `${endDateObj.toISOString().split("T")[0]}T23:59:59`,
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

                // 🔥🔥 Sadece PickupDate === bugün olan kayıtları sayıyoruz
                const filteredItems = items.filter((item) => {
                    const pickupDate = item.PickupDate?.split("T")[0];
                    const req = item.TMSVehicleRequestDocumentNo;
                    return (
                        pickupDate === todayStr &&
                        item.OrderStatu !== 200 &&
                        req && !req.startsWith("BOS") &&
                        item.ProjectName
                    );
                });

                const projectMap = new Map();

                filteredItems.forEach((item) => {
                    const project = normalizeProjectName(item.ProjectName);
                    const reqNo = item.TMSVehicleRequestDocumentNo;
                    const hasDespatch = item.TMSDespatchDocumentNo && !item.TMSDespatchDocumentNo.startsWith("BOS");
                    const vehicleWorking = (item?.VehicleWorkingName || "").toUpperCase();

                    if (!projectMap.has(project)) {
                        projectMap.set(project, {
                            ProjectName: project,
                            talepSet: new Set(),
                            tedarikSet: new Set(),
                            spotSet: new Set(),  // ✅ yeni
                            filoSet: new Set(),  // ✅ yeni
                        });
                    }

                    const projData = projectMap.get(project);

                    projData.talepSet.add(reqNo);

                    if (hasDespatch) {
                        projData.tedarikSet.add(reqNo);
                    }

                    // ✅ Benzersiz olarak SPOT/FİLO say
                    if (vehicleWorking.includes("SPOT")) {
                        projData.spotSet.add(reqNo);
                    } else if (vehicleWorking.includes("FİLO") || vehicleWorking.includes("FILO")) {
                        projData.filoSet.add(reqNo);
                    }
                });


                const finalData = Array.from(projectMap.values()).map((proj) => ({
                    ProjectName: proj.ProjectName,
                    Talep: proj.talepSet.size,
                    Tedarik: proj.tedarikSet.size,
                    Verilemeyen: proj.talepSet.size - proj.tedarikSet.size,
                    Spot: proj.spotSet.size,   // ✅ değiştirildi
                    Filo: proj.filoSet.size,   // ✅ değiştirildi
                }));


                console.log("🎯 ODAK VERİSİ (PickupDate === bugün):");
                finalData.forEach(p => {
                    console.log(`${p.ProjectName}: TALEP = ${p.Talep}, TEDARİK = ${p.Tedarik}, VERİLEMEYEN = ${p.Verilemeyen}, SPOT = ${p.Spot}, FİLO = ${p.Filo}`);
                });

                setOdakData(finalData.filter(p => ALLOWED_PROJECTS.has(p.ProjectName)));
                setOdakDataRaw(filteredItems); // sadece bugün yüklemesi olan kayıtlar

            } catch (err) {
                console.error("Odak API hatası:", err);
            }
        }

        fetchOdakData();
    }, []);





    useEffect(() => {
        if (!data.length || !odakData.length) return;

        const header = data[0];
        const rows = data.slice(1).map((row) => ({
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
                    row["REEL SPOT"] += odak.Spot ?? 0;          // ✅ EKLE
                    row["REEL FİLO"] += odak.Filo ?? 0;          // ✅ EKLE
                }
            }
        });


        // ✅ BURAYI EKLE — uyumsuz projeleri hesapla
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
    }, [odakData]);



    return (
        <div className="app-container">
            <div className="section">
                {uyumsuzProjeler.length > 0 && (
                    <div className="uyari-modal">
                        <button
                            className="modal-close"
                            onClick={() => {
                                setUyumsuzProjeler([]);      // paneli kapat
                                setUyumsuzKapandi(true);     // renklendirmeyi başlat
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
                                    {(isOnur || isTahsin) && <th rowSpan="3">TOP. NAVLUN</th>}
                                    {(isOnur || isTahsin) && <th colSpan="2">HEDEF ÜSTÜ</th>}
                                    {(isOnur || isTahsin) && <th colSpan="2">HEDEF ALTI</th>}
                                    {(isOnur || isTahsin) && <th rowSpan="3">HEDEF</th>}
                                    {(isOnur || isTahsin) && <th rowSpan="3">SEFER</th>}
                                    {(isOnur || isTahsin) && <th rowSpan="3">HEDEFSİZ SEFER</th>}
                                </tr>
                                <tr>
                                    {/* E-TABLO / REEL başlıkları */}
                                    {Array(9).fill().map((_, i) => (
                                        <React.Fragment key={i}>
                                            <th>E-TABLO</th>
                                            <th>REEL</th>
                                        </React.Fragment>
                                    ))}
                                    {(isOnur || isTahsin) && (
                                        <>
                                            <th>₺</th><th>SEFER</th>
                                            <th>₺</th><th>SEFER</th>
                                        </>
                                    )}
                                </tr>
                                {/* 3. satır boş tutuluyor — hizalama için */}
                                <tr></tr>
                            </thead>







                            <tbody>
                                {(() => {
                                    const renderedRows = new Set();

                                    return data.slice(1).flatMap((row) => {
                                        const projeAdi = row["PROJE ADI"]?.trim();
                                        const anaProje = Object.entries(projectMergeMap).find(([_, group]) =>
                                            group.includes(projeAdi)
                                        )?.[0];

                                        if (anaProje && renderedRows.has(projeAdi)) return [];

                                        const groupRows = anaProje
                                            ? data.slice(1).filter((r) =>
                                                projectMergeMap[anaProje].includes(r["PROJE ADI"]?.trim())
                                            )
                                            : [row];

                                        groupRows.forEach((r) =>
                                            renderedRows.add(r["PROJE ADI"]?.trim())
                                        );

                                        return groupRows.map((groupRow, groupIdx) => (
                                            <tr
                                                key={`row-${groupRow["PROJE ADI"]?.trim() || "bilinmiyor"}-${groupIdx}`}
                                                className={(() => {
                                                    const projeAdi = groupRow["PROJE ADI"]?.trim();
                                                    const reelTalep = parseFloat(groupRow["REEL TALEP"]) || 0;
                                                    const talep = parseFloat(groupRow["TALEP"]) || 0;

                                                    if (reelTalep > talep) return "fazla-reel-talep";
                                                    if (uyumsuzKapandi && uyumsuzProjeler.find(p => p.proje === projeAdi)) return "uyumsuz-satir";
                                                    return "";
                                                })()}
                                            >
                                                {columnOrder.map((col, colIdx) => {
                                                    let value = groupRow[col];
                                                    let style = {};
                                                    let displayValue = value;

                                                    // 🔥 Tıklanabilir PROJE ADI
                                                    if (col === "PROJE ADI") {
                                                        return (
                                                            <td
                                                                key={colIdx}
                                                                className="clickable-project"
                                                                style={{ fontWeight: "bold", cursor: "pointer", color: "#2980b9" }}
                                                                onClick={() => {
                                                                    const name = groupRow["PROJE ADI"]?.trim();
                                                                    const normalizeProjectName = (name) => {
                                                                        const map = {
                                                                            "BUNGE DİLOVASI-REYSAŞ": "BUNGE GEBZE FTL",
                                                                            "BUNGE PALET": "BUNGE PALET",
                                                                            "BUNGE LÜLEBURGAZ FTL": "BUNGE LÜLEBURGAZ FTL",
                                                                        };
                                                                        return map[name] || name;
                                                                    };
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
                                                    }
                                                    else if (col === "TOP. NAVLUN") {
                                                        const parsed = parseFloat(value);
                                                        displayValue = !isNaN(parsed) ? `${parsed.toLocaleString("tr-TR")} ₺` : "0 ₺";
                                                        style = { color: "#000" };
                                                    }
                                                    else if (["SEFER_ÜSTÜ", "SEFER_ALTI", "SEFER_HEDEF", "HEDEFSİZ SEFER"].includes(col)) {
                                                        const parsed = parseFloat(value);
                                                        displayValue = !isNaN(parsed) ? parsed.toLocaleString("tr-TR") : 0;
                                                    }
                                                    else if (col === "TED. %") {
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
                                                    }
                                                    else if (col === "UYUM") {
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
                                                    if (talep === 0 && talep0Columns.has(col)) {
                                                        finalDisplay = "-";
                                                    } else if (reelTalep === 0 && reelTalep0Columns.has(col)) {
                                                        finalDisplay = "-";
                                                    } else {
                                                        finalDisplay = displayValue ?? 0;
                                                    }

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
                                    {columnOrder.map((col, colIdx) => {
                                        // 1️⃣ "PROJE ADI" başlığı için
                                        if (col === "PROJE ADI") {
                                            return <td key={colIdx}><strong>TOPLAM</strong></td>;
                                        }

                                        // 2️⃣ Yüzdelik oran hesaplamaları
                                        if (col === "TED. %") {
                                            const totalTalep = data.slice(1).reduce((sum, row) => sum + (parseFloat(row["TALEP"]) || 0), 0);
                                            const totalTedarik = data.slice(1).reduce((sum, row) => sum + (parseFloat(row["TEDARİK"]) || 0), 0);
                                            const ratio = totalTalep > 0 ? totalTedarik / totalTalep : 0;
                                            const percentage = Math.round(ratio * 100);
                                            const color = percentage < 70 ? "#e74c3c" : percentage < 90 ? "#f39c12" : "#27ae60";

                                            return (
                                                <td key={colIdx} style={{ color, fontWeight: "bold", textAlign: "center" }}>
                                                    %{percentage}
                                                </td>
                                            );
                                        }


                                        if (col === "UYUM") {
                                            const totalReelTedarik = data.slice(1).reduce((sum, row) => sum + (parseFloat(row["REEL TEDARİK"]) || 0), 0);
                                            const totalReelTalep = data.slice(1).reduce((sum, row) => sum + (parseFloat(row["REEL TALEP"]) || 0), 0);
                                            const ratio = totalReelTalep > 0 ? totalReelTedarik / totalReelTalep : 0;
                                            const percentage = Math.round(ratio * 100);
                                            const color = percentage < 70 ? "#e74c3c" : percentage < 90 ? "#f39c12" : "#27ae60";

                                            return (
                                                <td key={colIdx} style={{ color, fontWeight: "bold", textAlign: "center" }}>
                                                    %{percentage}
                                                </td>
                                            );
                                        }


                                        // 3️⃣ Sayısal sütunların toplamı
                                        const total = data.slice(1).reduce((sum, row) => {
                                            const val = parseFloat(row[col]);
                                            return sum + (isNaN(val) ? 0 : val);
                                        }, 0);

                                        let displayValue = total.toLocaleString("tr-TR");
                                        let style = { fontWeight: "bold", textAlign: "center" };

                                        // 4️⃣ ₺ olan kolonlar biçimlendirme
                                        if (["TOP. NAVLUN", "HEDEF", "HEDEF ÜSTÜ", "HEDEF ALTI"].includes(col)) {
                                            displayValue += " ₺";
                                            style.color = col === "TOP. NAVLUN"
                                                ? "#000"
                                                : total < 0 ? "#e74c3c" : total === 0 ? "#000" : "#1e8449";
                                        }

                                        return (
                                            <td key={colIdx} style={style}>
                                                {displayValue}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tfoot>






                        </table>
                    </div>
                ) : (
                    <p className="loading">Yükleniyor...</p>
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
