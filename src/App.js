import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);




const columnOrder = [
    "PROJE ADI", "TALEP", "TEDARİK", "VERİLEMEYEN",
    "REEL TALEP", "REEL TEDARİK", "REEL VERİLEMEYEN",
    "UYUM",
    "TED. %", "SPOT", "FİLO", "TESİSTE", "GELECEK", "YÜKLENDİ",
    "TOP. NAVLUN",          // ✅ Buraya taşındı
    "HEDEF ÜSTÜ", "SEFER_ÜSTÜ",
    "HEDEF ALTI", "SEFER_ALTI", "SEFER_HEDEF",
    "HEDEFSİZ SEFER"
];

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




function App() {
    const [data, setData] = useState([]);
    const [odakData, setOdakData] = useState([]);
    const [uyumsuzProjeler, setUyumsuzProjeler] = useState([]);
    const [uyumsuzKapandi, setUyumsuzKapandi] = useState(false);



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

            const today = new Date().toISOString().split("T")[0];
            const payload = {
                startDate: `${today}T00:00:00`,
                endDate: `${today}T23:59:59`,
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

                // Filtreleme: sadece bugüne ait ve BOS ile başlamayan kayıtlar
                const filteredItems = items.filter((item) => {
                    const pickupDate = item.PickupDate?.split("T")[0];
                    const req = item.TMSVehicleRequestDocumentNo;
                    return (
                        pickupDate === today &&
                        item.OrderStatu !== 200 &&
                        req && !req.startsWith("BOS") &&
                        item.ProjectName
                    );
                });

                const projectMap = new Map();

                filteredItems.forEach((item) => {
                    const originalProject = item.ProjectName;
                    const project = normalizeProjectName(originalProject); // 👈 burada isim dönüşüyor
                    const reqNo = item.TMSVehicleRequestDocumentNo;
                    const hasDespatch = item.TMSDespatchDocumentNo && !item.TMSDespatchDocumentNo.startsWith("BOS");

                    if (!projectMap.has(project)) {
                        projectMap.set(project, {
                            ProjectName: project,
                            talepSet: new Set(),
                            tedarikSet: new Set()
                        });
                    }

                    const projData = projectMap.get(project);
                    projData.talepSet.add(reqNo);
                    if (hasDespatch) {
                        projData.tedarikSet.add(reqNo);
                    }
                });

                const finalData = Array.from(projectMap.values()).map((proj) => ({
                    ProjectName: proj.ProjectName,
                    Talep: proj.talepSet.size,
                    Tedarik: proj.tedarikSet.size,
                    Verilemeyen: proj.talepSet.size - proj.tedarikSet.size
                }));

                // Konsolda detaylı göster
                console.log("🎯 ODAK VERİSİ:");
                finalData.forEach(p => {
                    console.log(`${p.ProjectName}: TALEP = ${p.Talep}, TEDARİK = ${p.Tedarik}, VERİLEMEYEN = ${p.Verilemeyen}`);
                });

                setOdakData(finalData.filter(p => ALLOWED_PROJECTS.has(p.ProjectName)));
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
        }));

        odakData.forEach((odak) => {
            for (let row of rows) {
                const projeAdi = row["PROJE ADI"]?.trim();
                if (projeAdi === odak.ProjectName) {
                    row["REEL TALEP"] += odak.Talep ?? 0;
                    row["REEL TEDARİK"] += odak.Tedarik ?? 0;
                    row["REEL VERİLEMEYEN"] += odak.Verilemeyen ?? 0;
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
                                    <th rowSpan="2">PROJE ADI</th>
                                    <th colSpan="3" className="etablo">E-TABLO</th>
                                    <th colSpan="4" className="reel">REEL</th>
                                    <th rowSpan="2">TED. %</th>
                                    <th rowSpan="2">SPOT</th>
                                    <th rowSpan="2">FİLO</th>
                                    <th rowSpan="2">TESİSTE</th>
                                    <th rowSpan="2">GELECEK</th>
                                    <th rowSpan="2">YÜKLENDİ</th>
                                    <th rowSpan="2">TOP. NAVLUN</th>
                                    <th rowSpan="2">HEDEF ÜSTÜ</th>
                                    <th rowSpan="2">SEFER</th>
                                    <th rowSpan="2">HEDEF ALTI</th>
                                    <th rowSpan="2">SEFER</th>
                                    <th rowSpan="2">HEDEFTE SEFER</th>
                                    <th rowSpan="2">HEDEFSİZ SEFER</th>
                                </tr>
                                    <tr>
                                        <th className="etablo">TALEP</th>
                                        <th className="etablo">TEDARİK</th>
                                        <th className="etablo">VERİLEMEYEN</th>
                                        <th className="reel">REEL TALEP</th>
                                        <th className="reel">REEL TEDARİK</th>
                                        <th className="reel">REEL VERİLEMEYEN</th>
                                        <th className="reel">UYUM</th>
                                    </tr>
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
                    key={`${groupRow["PROJE ADI"]?.trim() || `row`}-${Math.random()}`}
                    className={
                        uyumsuzKapandi &&
                            uyumsuzProjeler.find(p => p.proje === groupRow["PROJE ADI"]?.trim())
                            ? "uyumsuz-satir"
                            : ""
                    }
                >
                    {columnOrder.map((col, colIdx) => {
                        let value = groupRow[col];
                        let style = {};
                        let displayValue = value;

                        // Fiyat kolonları için özel gösterim (₺ ve renkli)
                        // HEDEF, HEDEF ÜSTÜ, HEDEF ALTI için ₺ ve özel renkler
                        if (["HEDEF", "HEDEF ÜSTÜ", "HEDEF ALTI"].includes(col)) {
                            const parsed = parseFloat(value);
                            displayValue = !isNaN(parsed) ? `${parsed.toLocaleString("tr-TR")} ₺` : "0 ₺";

                            if (isNaN(parsed) || parsed === 0) {
                                style = { color: "#000" }; // 0 için siyah
                            } else if (parsed < 0) {
                                style = { color: "#e74c3c", fontWeight: "bold" }; // negatif
                            } else {
                                style = { color: "#1e8449", fontWeight: "bold" }; // pozitif
                            }
                        }

                        // ✅ TOP. NAVLUN için ₺ ve daima siyah renk
                        else if (col === "TOP. NAVLUN") {
                            const parsed = parseFloat(value);
                            displayValue = !isNaN(parsed) ? `${parsed.toLocaleString("tr-TR")} ₺` : "0 ₺";
                            style = { color: "#000" }; // Her zaman siyah ve kalın
                        }

                        

                        // Sefer kolonları (sayısal)
                        else if (
                            ["SEFER_ÜSTÜ", "SEFER_ALTI", "SEFER_HEDEF", "HEDEFSİZ SEFER"].includes(col)
                        ) {
                            const parsed = parseFloat(value);
                            displayValue = !isNaN(parsed) ? parsed.toLocaleString("tr-TR") : 0;
                        }

                        // TED. % özel biçimlendirme
                        else if (col === "TED. %") {
                            const parsed = parseFloat(value);
                            if (!isNaN(parsed)) {
                                const percentage = Math.round(parsed * 100);
                                displayValue = `%${percentage}`;
                                style = {
                                    color: percentage < 70 ? "#e74c3c" : percentage < 90 ? "#f39c12" : "#27ae60",
                                    fontWeight: "bold",
                                };
                            }
                        }

                        // UYUM sütunu hesaplama
                        else if (col === "UYUM") {
                            const reelTalep = parseFloat(groupRow["REEL TALEP"]) || 0;
                            const talep = parseFloat(groupRow["TALEP"]) || 0;
                            const uyumRatio = talep > 0 ? reelTalep / talep : 0;
                            const percentage = Math.round(uyumRatio * 100);
                            displayValue = `%${percentage}`;
                            style = {
                                color: percentage < 70 ? "#e74c3c" : percentage < 90 ? "#f39c12" : "#27ae60",
                                fontWeight: "bold",
                            };
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

                        return (
                            <td key={colIdx} style={style}>
                                {displayValue || 0}
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
                                        if (col === "PROJE ADI") return <td key={colIdx}><strong>TOPLAM</strong></td>;

                                        if (col === "TED. %") {
                                            const totalTalep = data.slice(1).reduce((sum, row) => sum + (parseFloat(row["REEL TALEP"]) || 0), 0);
                                            const totalTedarik = data.slice(1).reduce((sum, row) => sum + (parseFloat(row["REEL TEDARİK"]) || 0), 0);
                                            const ratio = totalTalep > 0 ? totalTedarik / totalTalep : 0;
                                            const percentage = Math.round(ratio * 100);
                                            let color = "#27ae60";
                                            if (percentage < 70) color = "#e74c3c";
                                            else if (percentage < 90) color = "#f39c12";

                                            return (
                                                <td key={colIdx} style={{ color, fontWeight: "bold" }}>
                                                    %{percentage}
                                                </td>
                                            );
                                        }

                                        if (col === "UYUM") {
                                            const totalTalep = data.slice(1).reduce((sum, row) => sum + (parseFloat(row["TALEP"]) || 0), 0);
                                            const totalReelTalep = data.slice(1).reduce((sum, row) => sum + (parseFloat(row["REEL TALEP"]) || 0), 0);
                                            const uyumOrani = totalTalep > 0 ? totalReelTalep / totalTalep : 0;
                                            const percentage = Math.round(uyumOrani * 100);
                                            let color = "#27ae60";
                                            if (percentage < 70) color = "#e74c3c";
                                            else if (percentage < 90) color = "#f39c12";

                                            return (
                                                <td key={colIdx} style={{ color, fontWeight: "bold" }}>
                                                    %{percentage}
                                                </td>
                                            );
                                        }

                                        const sourceCol =
                                            col === "HEDEF ÜSTÜ" ? "HEDEF ÜSTÜ" :
                                                col === "SEFER_ÜSTÜ" ? "SEFER_ÜSTÜ" :
                                                    col === "HEDEF ALTI" ? "HEDEF ALTI" :
                                                        col === "SEFER_ALTI" ? "SEFER_ALTI" :
                                                            col === "SEFER_HEDEF" ? "SEFER_HEDEF" :
                                                                col === "TOP. NAVLUN" ? "TOP. NAVLUN" :
                                                                    col;

                                        const total = data.slice(1).reduce((sum, row) => {
                                            const val = parseFloat(row[sourceCol]);
                                            return sum + (isNaN(val) ? 0 : val);
                                        }, 0);

                                        let displayValue = total.toLocaleString("tr-TR");
                                        let style = {};

                                        if (["HEDEF", "HEDEF ÜSTÜ", "HEDEF ALTI"].includes(col)) {
                                            displayValue = `${displayValue} ₺`;

                                            if (total === 0) {
                                                style = { color: "#000", fontWeight: "bold" };
                                            } else if (total < 0) {
                                                style = { color: "#e74c3c", fontWeight: "bold" };
                                            } else {
                                                style = { color: "#1e8449", fontWeight: "bold" };
                                            }
                                        } else if (col === "TOP. NAVLUN") {
                                            displayValue = `${total.toLocaleString("tr-TR")} ₺`;
                                            style = { color: "#000", fontWeight: "bold" }; // Her zaman siyah
                                        }

                                        return (
                                            <td key={colIdx} style={style}>
                                                <strong>{displayValue}</strong>
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
            </div>
        </div>
    );
}

export default App;
