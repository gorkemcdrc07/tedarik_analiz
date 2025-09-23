import React, { useRef, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import supabase from "../supabaseClient";
import { getToken, debugLogToken } from "../auth/tokenManager"; 
import "./GelirEkleme.css";

export default function GelirEkleme() {
    const inputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState(null);
    const [error, setError] = useState("");
    const [downloading, setDownloading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [sending, setSending] = useState(false); 
    const [previewHeaders, setPreviewHeaders] = useState([]);
    const [previewRows, setPreviewRows] = useState([]);
    const [missingHeaders, setMissingHeaders] = useState([]);
    const [mapStats, setMapStats] = useState({ matched: 0, unknown: 0 });
    const [rowResults, setRowResults] = useState({});
    const [sendSummary, setSendSummary] = useState(null); 
    const clearSendState = () => {
        setRowResults({});
        setSendSummary(null);
    };

    const allowed = useMemo(() => [".xlsx", ".xls"], []);

    const openPicker = () => inputRef.current?.click();

    const onFilePicked = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        validateAndSet(f);
    };

    const onDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (!f) return;
        validateAndSet(f);
    };

    const validateAndSet = (f) => {
        const ok = allowed.some((ext) => f.name.toLowerCase().endsWith(ext));
        if (!ok) {
            setError("Lütfen .xlsx veya .xls uzantılı bir dosya yükleyin.");
            setFile(null);
            return;
        }
        setError("");
        setFile(f);
        setPreviewHeaders([]);
        setPreviewRows([]);
        setMissingHeaders([]);
        setMapStats({ matched: 0, unknown: 0 });
        clearSendState(); 
    };

    const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };

    const reset = () => {
        setFile(null);
        setError("");
        setPreviewHeaders([]);
        setPreviewRows([]);
        setMissingHeaders([]);
        setMapStats({ matched: 0, unknown: 0 });
        if (inputRef.current) inputRef.current.value = "";
        clearSendState(); 
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };


    const downloadTemplate = async () => {
        try {
            setDownloading(true);

            const S_HEADERS = [
                "SeferID", "Cari Unvan", "Hesap Adı",
                "Birim Fiyat", "Miktar", "KDV Oranı", "Tevkifat Oranı", "Açıklama"
            ];
            const sablonWS = XLSX.utils.aoa_to_sheet([S_HEADERS]);
            sablonWS["!cols"] = [
                { wch: 10 }, { wch: 28 }, { wch: 16 }, { wch: 26 },
                { wch: 14 }, { wch: 10 }, { wch: 12 },
                { wch: 16 }, { wch: 44 },
            ];

            const { data, error } = await supabase
                .from("Fiyat_Ekleme_Hesap_Adlari")
                .select("tip_id,detay_id,hizmet_adi,kdv_oran");
            if (error) throw error;

            const D_HEADERS = ["tip_id", "detay_id", "hizmet_adi", "kdv_oran"];
            const rows = (data || []).map((r) => ([
                r.tip_id ?? null,
                r.detay_id ?? null,
                r.hizmet_adi ?? "",
                typeof r.kdv_oran === "string"
                    ? parseFloat(String(r.kdv_oran).replace(",", "."))
                    : Number(r.kdv_oran ?? 0)
            ]));
            const dokumanWS = XLSX.utils.aoa_to_sheet([D_HEADERS, ...rows]);
            dokumanWS["!cols"] = [{ wch: 8 }, { wch: 10 }, { wch: 46 }, { wch: 10 }];

            for (let r = 2; r <= rows.length + 1; r++) {
                const addr = "D" + r;
                const cell = dokumanWS[addr];
                if (cell && typeof cell.v === "number") cell.z = "0%";
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, sablonWS, "ŞABLON");
            XLSX.utils.book_append_sheet(wb, dokumanWS, "DÖKÜMAN");
            XLSX.writeFile(wb, "gelir_sablon.xlsx");
        } catch (err) {
            console.error(err);
            setError("DÖKÜMAN verisi alınamadı. Lütfen tekrar deneyin.");
        } finally {
            setDownloading(false);
        }
    };

    // normalize
    const norm = (s) =>
        s?.toString()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ı/g, "i")
            .replace(/İ/g, "i")
            .toLowerCase()
            .trim();


    const toDecimalString = (val, maxDecimals = 6) => {
        if (val === null || val === undefined) return "";

        let s = String(val)
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, "")
            .replace(/[^\d.,\-]/g, "");

        const lastComma = s.lastIndexOf(",");
        const lastDot = s.lastIndexOf(".");

        if (lastComma > -1 && lastDot > -1) {
            const decimalSep = lastComma > lastDot ? "," : ".";
            const thousandSep = decimalSep === "," ? "." : ",";
            s = s.split(thousandSep).join("");
            s = s.replace(decimalSep, ".");
        } else if (lastComma > -1) {
            s = s.replace(/\./g, "");
            s = s.replace(",", ".");
        } else {
            s = s.replace(/,/g, "");
        }

        // en fazla 6 ondalık haneye KES
        if (s.includes(".")) {
            const [intPart, fracPartRaw] = s.split(".");
            const fracPart = (fracPartRaw || "").slice(0, maxDecimals);
            s = fracPart.length ? `${intPart}.${fracPart}` : intPart;
        }

        if (s === "." || s === "-") return "";
        return s;
    };

    // Birim Fiyat ve Miktar dip toplamları
    const simpleTotals = useMemo(() => {
        if (!previewHeaders.length || !previewRows.length) {
            return { unitPriceSum: 0, qtySum: 0 };
        }
        const idx = (name) => previewHeaders.indexOf(name);
        const iBirimF = idx("Birim Fiyat");
        const iMiktar = idx("Miktar");
        if (iBirimF === -1 || iMiktar === -1) return { unitPriceSum: 0, qtySum: 0 };

        const toNumberLocal = (val) => {
            const s = toDecimalString(val, 6);
            if (s === "") return null;
            const n = Number(s);
            return Number.isFinite(n) ? n : null;
        };

        let unitPriceSum = 0;
        let qtySum = 0;

        for (const row of previewRows) {
            const u = toNumberLocal(row[iBirimF]);
            const q = toNumberLocal(row[iMiktar]);

            if (u != null) unitPriceSum += u;
            if (q != null) qtySum += q;
        }

        return { unitPriceSum, qtySum };
    }, [previewHeaders, previewRows]);

    // Dip toplamlar (tablodan bağımsız)
    const totals = useMemo(() => {
        if (!previewHeaders.length || !previewRows.length) {
            return { qty: 0, amount: 0 };
        }
        const idx = (name) => previewHeaders.indexOf(name);
        const iBirimF = idx("Birim Fiyat");
        const iMiktar = idx("Miktar");

        if (iBirimF === -1 || iMiktar === -1) return { qty: 0, amount: 0 };

        const toNumberLocal = (val) => {
            const s = toDecimalString(val, 6);
            if (s === "") return null;
            const n = Number(s);
            return Number.isFinite(n) ? n : null;
        };

        let qty = 0;
        let amount = 0;

        for (const row of previewRows) {
            const u = toNumberLocal(row[iBirimF]);
            const q = toNumberLocal(row[iMiktar]);
            const qSafe = (q == null || q <= 0) ? 1 : q;

            if (q != null && q > 0) qty += q;         
            if (u != null) amount += u * qSafe;     
        }

        return { qty, amount };
    }, [previewHeaders, previewRows]);

    // lookuplar
    const fetchDokumanLookup = async () => {
        const { data, error } = await supabase
            .from("Fiyat_Ekleme_Hesap_Adlari")
            .select("hizmet_adi, tip_id, detay_id");
        if (error) throw error;
        const map = new Map();
        (data || []).forEach(({ hizmet_adi, tip_id, detay_id }) => {
            map.set(norm(hizmet_adi), { tip_id, detay_id });
        });
        return map;
    };

    const fetchFirmaLookup = async () => {
        const { data, error } = await supabase
            .from("Firmalar")
            .select("firma_adi, firma_id");
        if (error) throw error;
        const map = new Map();
        (data || []).forEach(({ firma_adi, firma_id }) => {
            map.set(norm(firma_adi), { firma_id });
        });
        return map;
    };


    const startScan = async () => {
        if (!file) return;
        try {
            setScanning(true);
            setError("");
            clearSendState(); 

            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });

            const sheetName = wb.SheetNames.find((n) => norm(n) === "sablon");
            if (!sheetName) {
                setError(`Bu Excel'de "ŞABLON" adında bir sayfa bulunamadı. Bulunan sayfalar: ${wb.SheetNames.join(", ")}`);
                return;
            }

            const ws = wb.Sheets[sheetName];
            const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
            if (!aoa.length) {
                setError(`"${sheetName}" sayfası boş görünüyor.`);
                return;
            }

            let headers = aoa[0].map((h) => (h ?? "").toString().trim());
            let rows = aoa.slice(1);

            const requiredBase = [
                "SeferID", "Cari Unvan", "Hesap Adı",
                "Birim Fiyat", "Miktar", "KDV Oranı",
                "Tevkifat Oranı", "Açıklama"
            ];
            const missing = requiredBase.filter((r) => !headers.includes(r));

            let cariIdx = headers.indexOf("Cari Unvan");
            let hesapIdx = headers.indexOf("Hesap Adı");
            if (cariIdx === -1) { setError(`"Cari Unvan" başlığı bulunamadı.`); return; }
            if (hesapIdx === -1) { setError(`"Hesap Adı" başlığı bulunamadı.`); return; }


            let hmIdx = headers.indexOf("Hizmet/Masraf");
            if (hmIdx === -1) {
                const insertAt = 2;
                headers = [
                    ...headers.slice(0, insertAt),
                    "Hizmet/Masraf",
                    ...headers.slice(insertAt),
                ];
                hmIdx = insertAt;
                if (insertAt <= cariIdx) cariIdx += 1;
                if (insertAt <= hesapIdx) hesapIdx += 1;
                rows = rows.map((r) => {
                    const copy = [...r];
                    copy.splice(insertAt, 0, "");
                    return copy;
                });
            }

            const miktarIdx = headers.indexOf("Miktar");
            const kdvIdx = headers.indexOf("KDV Oranı");
            const tevIdx = headers.indexOf("Tevkifat Oranı");
            const birimFiyatIdx = headers.indexOf("Birim Fiyat");

            const [dokumanLookup, firmaLookup] = await Promise.all([
                fetchDokumanLookup(),
                fetchFirmaLookup(),
            ]);

            let matched = 0;
            let unknown = 0;

            rows = rows.map((r) => {
                const copy = [...r];
                const hizmetAdiCell = copy[hesapIdx];
                const rec = dokumanLookup.get(norm(hizmetAdiCell));
                if (rec) {
                    matched += 1;
                    copy[hmIdx] = rec.tip_id ?? "";
                    copy[hesapIdx] = rec.detay_id ?? "";
                } else {
                    unknown += 1;
                    copy[hmIdx] = copy[hmIdx] ?? "";
                }


                const cariCell = copy[cariIdx];
                const firm = firmaLookup.get(norm(cariCell));
                if (firm) {
                    copy[cariIdx] = firm.firma_id ?? "";
                }

                // Defaultlar
                if (miktarIdx !== -1) {
                    const v = copy[miktarIdx];
                    if (v === "" || v === null || typeof v === "undefined") copy[miktarIdx] = 1;
                }
                if (kdvIdx !== -1) {
                    const v = copy[kdvIdx];
                    if (v === "" || v === null || typeof v === "undefined") copy[kdvIdx] = "0,2"; 
                }
                if (tevIdx !== -1) {
                    const v = copy[tevIdx];
                    if (v === "" || v === null || typeof v === "undefined") copy[tevIdx] = "0,0";
                }

                // Birim Fiyat normalize
                if (birimFiyatIdx !== -1) {
                    const normVal = toDecimalString(copy[birimFiyatIdx]);
                    copy[birimFiyatIdx] = normVal === "" ? "" : normVal;
                }

                return copy;
            });

            setMapStats({ matched, unknown });
            setPreviewHeaders(headers);
            setPreviewRows(rows);
            setMissingHeaders(missing);
        } catch (e) {
            console.error(e);
            setError("Excel okunamadı. Lütfen dosyayı kontrol edin.");
        } finally {
            setScanning(false);
        }
    };


    const sendToReel = async () => {
        try {
            setSending(true);
            setError("");
            clearSendState(); 

            const token = await getToken();

            if (!previewHeaders.length || !previewRows.length) {
                setError("Önce dosyayı tarayın. Gönderilecek satır bulunamadı.");
                return;
            }

            const idx = (name) => previewHeaders.indexOf(name);
            const iSeferID = idx("SeferID");
            const iCari = idx("Cari Unvan");
            const iHM = idx("Hizmet/Masraf");
            const iHesapAdi = idx("Hesap Adı");
            const iBirimF = idx("Birim Fiyat");
            const iMiktar = idx("Miktar");
            const iKDV = idx("KDV Oranı");
            const iTevkifat = idx("Tevkifat Oranı");
            const iAciklama = idx("Açıklama");

            const missing = [
                ["SeferID", iSeferID], ["Cari Unvan", iCari], ["Hizmet/Masraf", iHM],
                ["Hesap Adı", iHesapAdi], ["Birim Fiyat", iBirimF], ["Miktar", iMiktar],
                ["KDV Oranı", iKDV], ["Tevkifat Oranı", iTevkifat], ["Açıklama", iAciklama],
            ].filter(([, i]) => i === -1).map(([n]) => n);
            if (missing.length) {
                setError(`Eksik kolon(lar): ${missing.join(", ")}. Lütfen "Taramayı Başlat" adımından sonra deneyin.`);
                return;
            }

            const toNumber = (val) => {
                const s = toDecimalString(val, 6);
                if (s === "") return null;
                const n = Number(s);
                return Number.isFinite(n) ? n : null;
            };
            const toRate = (val) => {
                if (val === "" || val === null || typeof val === "undefined") return 0;
                const n = toNumber(val); if (n === null) return 0;
                return n > 1 ? n / 100 : n; // 18 -> 0.18
            };
            const toPosInt = (val) => {
                const n = Number(String(val).trim());
                return Number.isFinite(n) && n > 0 ? n : null;
            };

            const endpoint =
                process.env.NODE_ENV === "production"
                    ? "/api/reel-api/tmsdespatchincomeexpenses/addincome"
                    : "/reel-api/api/tmsdespatchincomeexpenses/addincome";

            let ok = 0, fail = 0;
            const setRowResult = (rowIdx, result) =>
                setRowResults(prev => ({ ...prev, [rowIdx]: result }));

            for (let r = 0; r < previewRows.length; r++) {
                const row = previewRows[r] || [];
                const hasAny = row.some((cell) => cell !== "" && cell !== null && typeof cell !== "undefined");
                if (!hasAny) continue;


                const rawSefer = row[iSeferID];
                const rawCari = row[iCari];
                const rawHM = row[iHM];
                const rawHesap = row[iHesapAdi];

                const tmsDespatchId = toPosInt(rawSefer);
                const currentAccountId = toPosInt(rawCari);     
                const lineMovementType = toPosInt(rawHM);       
                const lineMovementId = toPosInt(rawHesap);    

                if (!tmsDespatchId || !currentAccountId || !lineMovementType || !lineMovementId) {
                    const details = [];
                    if (!tmsDespatchId) {
                        details.push(`SeferID hücresi: "${rawSefer ?? ""}" → Pozitif tam sayı olmalı (örn: 12345).`);
                    }
                    if (!currentAccountId) {
                        const looksNumeric = /^\d+$/.test(String(rawCari ?? "").trim());
                        details.push(
                            looksNumeric
                                ? `Cari Unvan (firma_id): "${rawCari ?? ""}" → Pozitif tam sayı (>0) olmalı.`
                                : `Cari Unvan: "${rawCari ?? ""}" → Firma adı 'Firmalar' tablosuyla eşleşmediği için ID'ye çevrilemedi. Çözüm: Firma adını 'Firmalar'dakiyle birebir yazın veya firmayı ekleyin; sonra "Taramayı Başlat" deyin.`
                        );
                    }
                    if (!lineMovementType) {
                        details.push(`Hizmet/Masraf (tip_id) hücresi: "${rawHM ?? ""}" → Pozitif tam sayı olmalı. (Tarama, "Hesap Adı"nı eşleştirince bunu otomatik doldurur.)`);
                    }
                    if (!lineMovementId) {
                        details.push(`Hesap Adı (detay_id) hücresi: "${rawHesap ?? ""}" → Pozitif tam sayı olmalı. (Eşleşmeyen "Hesap Adı" değerini DÖKÜMAN sayfasındaki listeyle kontrol edin.)`);
                    }
                    setRowResult(r, { status: "fail", message: "Zorunlu/pozitif ID alanları geçersiz.", details });
                    fail++;
                    continue;
                }

                // Fiyat / Miktar
                const unitPriceNum = toNumber(row[iBirimF]);
                if (unitPriceNum == null || unitPriceNum <= 0) {
                    const details = [
                        `Birim Fiyat hücresi: "${row[iBirimF] ?? ""}" → Sayı olmalı ve 0'dan büyük. Örn: 1250,5 veya 1250.5`,
                    ];
                    setRowResult(r, { status: "fail", message: "Geçerli Birim Fiyat zorunlu.", details });
                    fail++;
                    continue;
                }
                const quantityNum = toNumber(row[iMiktar]);
                const safeQty = (quantityNum == null || quantityNum <= 0) ? 1 : quantityNum;

                const payload = {
                    tmsDespatchId,
                    currentAccountId,
                    lineMovementType,
                    lineMovementId,
                    unitPrice: unitPriceNum,
                    quantity: Number(safeQty.toFixed(2)),
                    vatRate: toRate(row[iKDV]),
                    withholdingRate: toRate(row[iTevkifat]),
                    description: row[iAciklama] ?? "",
                    isFreight: false,
                };

                try {
                    const res = await fetch(endpoint, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(payload),
                    });

                    if (!res.ok) {
                        let bodyText = "";
                        try { bodyText = await res.text(); } catch { }
                        const trimmed = (bodyText || "").slice(0, 500);
                        const details = [
                            `HTTP durum: ${res.status}`,
                            trimmed ? `Sunucu cevabı: ${trimmed}` : "Sunucu detay vermedi.",
                        ];
                        setRowResult(r, { status: "fail", message: "API isteği başarısız.", details });
                        fail++;
                    } else {
                        setRowResult(r, { status: "ok", message: "Gönderildi." });
                        ok++;
                    }
                } catch (err) {
                    const details = [`Hata: ${err?.message || String(err)}`];
                    setRowResult(r, { status: "fail", message: "Ağ/istemci hatası.", details });
                    fail++;
                }
            }

            setSendSummary({ ok, fail });
            alert(`Gönderim tamamlandı ✅ Başarılı: ${ok} · Hatalı: ${fail}`);
        } catch (e) {
            console.error(e);
            setError("REEL'e gönderim sırasında bir hata oluştu.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="ge-page">
            <div className="ge-container">
                {/* Üst bar */}
                <div className="ge-topbar">
                    <div className="ge-top-actions">
                        <button className="btn ghost" onClick={downloadTemplate} disabled={downloading}>
                            {downloading ? "İndiriliyor…" : "Şablonu İndir (.xlsx)"}
                        </button>

                        <input
                            ref={inputRef}
                            type="file"
                            accept={[
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                "application/vnd.ms-excel",
                                ".xlsx",
                                ".xls",
                            ].join(",")}
                            onChange={onFilePicked}
                            hidden
                        />
                    </div>
                </div>

                {/* Dropzone */}
                <div
                    className={`ge-drop ${isDragging ? "dragging" : ""}`}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={openPicker}
                    role="button"
                    tabIndex={0}
                >
                    <div className="ge-drop-inner">
                        <div className="ge-icon">⬆️</div>
                        <div className="ge-title">Dosyanı buraya sürükle & bırak</div>
                        <div className="ge-muted">
                            veya <span className="ge-link">bilgisayardan seç</span> (.xlsx, .xls)
                        </div>
                    </div>
                </div>

                {/* Seçilen dosya */}
                {file && (
                    <div className="ge-file">
                        <div className="ge-file-main">
                            <div className="ge-file-icon">📄</div>
                            <div>
                                <div className="ge-file-name">{file.name}</div>
                                <div className="ge-file-meta">{formatSize(file.size)}</div>
                            </div>
                        </div>

                        <div className="ge-actions">
                            <button className="btn" onClick={startScan} disabled={scanning}>
                                {scanning ? "Taranıyor…" : "Taramayı Başlat"}
                            </button>
                            <button className="btn" onClick={sendToReel} disabled={sending}>
                                {sending ? "Bağlanıyor…" : "REEL'e Gönder"}
                            </button>
                            <button className="btn ghost danger" onClick={reset}>
                                Kaldır
                            </button>
                        </div>
                    </div>
                )}

                {/* Birim Fiyat & Miktar Dip Toplam */}
                {previewHeaders.length > 0 && (
                    <div className="ge-summary">
                        <div className="ge-summary-item">
                            <span>Birim Fiyat Toplamı:</span>
                            <strong>
                                {Number.isFinite(simpleTotals.unitPriceSum)
                                    ? simpleTotals.unitPriceSum.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                                    : "0,00"}
                            </strong>
                        </div>
                        <div className="ge-summary-item">
                            <span>Miktar Toplamı:</span>
                            <strong>
                                {Number.isFinite(simpleTotals.qtySum)
                                    ? simpleTotals.qtySum.toLocaleString("tr-TR", { maximumFractionDigits: 6 })
                                    : "0"}
                            </strong>
                        </div>
                    </div>
                )}

                {/* Uyarı/Hata */}
                {error && <div className="ge-error">{error}</div>}

                {/* Zorunlu kolon uyarısı */}
                {!!missingHeaders.length && (
                    <div className="ge-error" style={{ marginTop: 12 }}>
                        Eksik başlık(lar): <strong>{missingHeaders.join(", ")}</strong>
                    </div>
                )}

                {/* Önizleme + gönderim sonuçları */}
                {previewHeaders.length > 0 && (
                    <>
                        {/* Gönderim özeti */}
                        {sendSummary && (
                            <div className={`ge-banner ${sendSummary.fail ? "danger" : "success"}`}>
                                Gönderim tamamlandı — Başarılı: <strong>{sendSummary.ok}</strong> · Hatalı: <strong>{sendSummary.fail}</strong>
                            </div>
                        )}

                        {/* Hatalı satır listesi*/}
                        {Object.entries(rowResults).some(([, v]) => v?.status === "fail") && (
                            <div className="ge-error" style={{ marginTop: 12 }}>
                                <strong>Hatalı satırlar:</strong>
                                <ul className="ge-error-list">
                                    {Object.entries(rowResults)
                                        .filter(([, v]) => v?.status === "fail")
                                        .map(([idx, v]) => {
                                            const excelRow = Number(idx) + 2; 
                                            return (
                                                <li key={idx}>
                                                    Satır {excelRow}: {v?.message || "Bilinmeyen hata"}
                                                    {Array.isArray(v?.details) && v.details.length > 0 && (
                                                        <ul className="ge-error-sublist">
                                                            {v.details.map((d, i) => (
                                                                <li key={i}>{d}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </li>
                                            );
                                        })}
                                </ul>
                            </div>
                        )}

                        {/* Önizleme Tablosu */}
                        <div className="ge-table-wrap">
                            <div className="ge-table-top">
                                <span>Önizleme: <strong>{previewRows.length}</strong> satır</span>
                                <span className="ge-sheet-name">
                                    Kaynak sayfa: <strong>ŞABLON / {previewHeaders.length} kolon</strong>
                                    {" · "}Hizmet/Masraf eşleşti: <strong>{mapStats.matched}</strong>
                                    {" / "}bulunamadı: <strong>{mapStats.unknown}</strong>
                                </span>
                            </div>
                            <div className="ge-table-scroll">
                                <div className="ge-table-inner">
                                    <table className="ge-table">
                                        <thead>
                                            <tr>
                                                {previewHeaders.map((h, i) => (
                                                    <th key={i} className={missingHeaders.includes(h) ? "miss" : ""}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewRows.map((row, rIdx) => {
                                                const rr = rowResults[rIdx];
                                                const rowClass =
                                                    rr?.status === "fail" ? "row-fail" :
                                                        rr?.status === "ok" ? "row-ok" : "";
                                                const title = rr?.message || "";
                                                return (
                                                    <tr key={rIdx} className={rowClass} title={title}>
                                                        {previewHeaders.map((_, cIdx) => (
                                                            <td key={cIdx}>{row[cIdx] ?? ""}</td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
