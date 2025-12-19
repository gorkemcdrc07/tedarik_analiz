import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import supabase from "../supabaseClient";
import { authorizedJson } from "../auth/tokenManager";
import { FiUploadCloud, FiFile, FiCheckCircle, FiXCircle, FiAlertTriangle, FiTrash2, FiDownload, FiSearch, FiSend, FiRefreshCw } from 'react-icons/fi';
// import "./GelirEkleme.css"; // CSS dosyası kaldırıldı.

// API Base URL (Değişmedi)
const endpoint = `/api/reel-api/tmsdespatchincomeexpenses/addincome`;

// --- Renk Paleti ve Stil Sabitleri ---
const COLORS = {
    primary: '#007bff',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    text: '#333',
    border: '#e0e0e0',
    background: '#f8f9fa',
    cardBackground: '#ffffff',
    muted: '#6c757d',
};

const STYLES = {
    page: {
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        color: COLORS.text,
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: `1px solid ${COLORS.border}`,
    },
    h2: {
        margin: 0,
        fontSize: '28px',
        fontWeight: 600,
        color: COLORS.primary,
    },
    card: {
        background: COLORS.cardBackground,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        padding: '24px',
        marginBottom: '20px',
        border: `1px solid ${COLORS.border}`,
    },
    buttonBase: {
        padding: '10px 15px',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 500,
        transition: 'background-color 0.2s, opacity 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
    },
    buttonPrimary: {
        backgroundColor: COLORS.primary,
        color: COLORS.cardBackground,
    },
    buttonSuccess: {
        backgroundColor: COLORS.success,
        color: COLORS.cardBackground,
    },
    buttonDanger: {
        backgroundColor: COLORS.danger,
        color: COLORS.cardBackground,
    },
    buttonGhost: {
        background: 'transparent',
        color: COLORS.primary,
        border: `1px solid ${COLORS.primary}`,
    },
    disabled: {
        opacity: 0.6,
        cursor: 'not-allowed',
    },
    alertBase: {
        padding: '15px',
        borderRadius: '8px',
        marginTop: '15px',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    alertError: {
        backgroundColor: 'rgba(220, 53, 69, 0.1)',
        color: COLORS.danger,
        border: `1px solid ${COLORS.danger}`,
    },
    alertWarning: {
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        color: '#856404',
        border: `1px solid ${COLORS.warning}`,
    },
    alertSuccess: {
        backgroundColor: 'rgba(40, 167, 69, 0.1)',
        color: COLORS.success,
        border: `1px solid ${COLORS.success}`,
    }
};

// --- Yeni Toast Bileşeni ---
const ToastMessage = ({ message, type, onClose }) => {
    if (!message) return null;

    const isSuccess = type === 'success';
    const bgColor = isSuccess ? COLORS.success : COLORS.danger;
    const Icon = isSuccess ? FiCheckCircle : FiXCircle;
    const title = isSuccess ? 'İşlem Başarılı' : 'İşlem Başarısız';

    const toastStyle = {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        backgroundColor: COLORS.cardBackground,
        padding: '15px 25px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        borderLeft: `5px solid ${bgColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        maxWidth: '400px',
        transition: 'opacity 0.3s ease-out'
    };

    const iconStyle = {
        color: bgColor,
        flexShrink: 0
    };

    const closeButtonStyle = {
        marginLeft: '10px',
        background: 'none',
        border: 'none',
        color: COLORS.muted,
        cursor: 'pointer',
        fontSize: '18px',
    };

    return (
        <div style={toastStyle}>
            <Icon size={24} style={iconStyle} />
            <div>
                <strong style={{ display: 'block', fontSize: '16px', color: COLORS.text }}>{title}</strong>
                <p style={{ margin: 0, fontSize: '14px', color: COLORS.muted }}>{message}</p>
            </div>
            <button onClick={onClose} style={closeButtonStyle}>&times;</button>
        </div>
    );
};
// --- Yardımcı Fonksiyonlar (Aynı) ---
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
    if (s.includes(".")) {
        const [intPart, fracPartRaw] = s.split(".");
        const fracPart = (fracPartRaw || "").slice(0, maxDecimals);
        s = fracPart.length ? `${intPart}.${fracPart}` : intPart;
    }
    if (s === "." || s === "-") return "";
    return s;
};

const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ... (fetchDokumanLookup ve fetchFirmaLookup aynı)
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


export default function GelirEkleme() {
    // --- State'ler ---
    const inputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState(null);
    const [error, setError] = useState("");
    const [scanning, setScanning] = useState(false);
    const [sending, setSending] = useState(false);
    const [previewHeaders, setPreviewHeaders] = useState([]);
    const [previewRows, setPreviewRows] = useState([]);
    const [missingHeaders, setMissingHeaders] = useState([]);
    const [mapStats, setMapStats] = useState({ matched: 0, unknown: 0 });
    const [rowResults, setRowResults] = useState({});
    const [sendSummary, setSendSummary] = useState(null);
    const [notification, setNotification] = useState(null); // { message: '', type: 'success' | 'fail' }

    // --- Sabitler ---
    const allowedExtensions = useMemo(() => [".xlsx", ".xls"], []);

    // --- Bildirim Otomatik Kapatma Efekti ---
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 5000); // 5 saniye sonra kapat
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // --- State Temizleme Fonksiyonları ---
    const closeNotification = useCallback(() => {
        setNotification(null);
    }, []);

    const clearSendState = useCallback(() => {
        setRowResults({});
        setSendSummary(null);
        closeNotification();
    }, [closeNotification]);

    const reset = useCallback(() => {
        setFile(null);
        setError("");
        setPreviewHeaders([]);
        setPreviewRows([]);
        setMissingHeaders([]);
        setMapStats({ matched: 0, unknown: 0 });
        if (inputRef.current) inputRef.current.value = "";
        clearSendState();
    }, [clearSendState]);

    // --- Dosya İşleme Fonksiyonları (Aynı) ---
    const validateAndSet = useCallback((f) => {
        const ok = allowedExtensions.some((ext) => f.name.toLowerCase().endsWith(ext));
        if (!ok) {
            setError("❌ Lütfen .xlsx veya .xls uzantılı bir dosya yükleyin.");
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
    }, [allowedExtensions, clearSendState]);

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

    const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };

    const downloadTemplate = async () => {
        try {
            const res = await fetch("/gelir_sablon.xlsx", { method: "GET" });
            if (!res.ok) throw new Error("Şablon indirilemedi.");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "gelir_sablon.xlsx"; // dosya adı burada
            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(url);
        } catch (e) {
            const msg = e?.message || "Şablon indirirken hata oluştu.";
            setError(`❌ ${msg}`);
            setNotification({ message: msg, type: "fail" });
        }
    };

    // --- Tarama Fonksiyonu (Güncellendi) ---
    const startScan = async () => {
        if (!file) return;
        try {
            setScanning(true);
            setError("");
            clearSendState();

            // ... (Excel okuma, sayfa bulma, başlık/satır çıkarma mantığı) ...
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });

            const sheetName = wb.SheetNames.find((n) => norm(n) === "sablon");
            if (!sheetName) {
                const msg = `Bu Excel'de "ŞABLON" adında bir sayfa bulunamadı. Bulunan sayfalar: ${wb.SheetNames.join(", ")}`;
                setError(`❌ ${msg}`);
                setNotification({ message: msg, type: 'fail' });
                return;
            }
            const ws = wb.Sheets[sheetName];
            const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
            if (!aoa.length) {
                const msg = `"${sheetName}" sayfası boş görünüyor.`;
                setError(`❌ ${msg}`);
                setNotification({ message: msg, type: 'fail' });
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
            if (cariIdx === -1) {
                const msg = `"Cari Unvan" başlığı bulunamadı.`;
                setError(`❌ ${msg}`);
                setNotification({ message: msg, type: 'fail' });
                return;
            }
            if (hesapIdx === -1) {
                const msg = `"Hesap Adı" başlığı bulunamadı.`;
                setError(`❌ ${msg}`);
                setNotification({ message: msg, type: 'fail' });
                return;
            }

            // 'Hizmet/Masraf' kolonu yoksa ekle
            let hmIdx = headers.indexOf("Hizmet/Masraf");
            if (hmIdx === -1) {
                const insertAt = 2;
                headers = [...headers.slice(0, insertAt), "Hizmet/Masraf", ...headers.slice(insertAt),];
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

            const [dokumanLookup, firmaLookup] = await Promise.all([fetchDokumanLookup(), fetchFirmaLookup()]);

            let matched = 0;
            let unknown = 0;

            rows = rows.map((r) => {
                const copy = [...r];

                // 1. Hesap Adı eşleştirme
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

                // 2. Cari Unvan eşleştirme
                const cariCell = copy[cariIdx];
                const firm = firmaLookup.get(norm(cariCell));
                if (firm) {
                    copy[cariIdx] = firm.firma_id ?? "";
                }

                // 3. Default değerler
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

                // 4. Birim Fiyat normalize
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

            // Başarılı bildirim
            setNotification({
                message: `${rows.length} satır tarandı ve önizleme tablosuna yüklendi. ${matched} Hesap Adı eşleşti.`,
                type: 'success'
            });

        } catch (e) {
            console.error(e);
            const msg = "Excel okunamadı. Lütfen dosyayı veya sayfa adını kontrol edin.";
            setError(`❌ ${msg}`);
            setNotification({ message: msg, type: 'fail' });
        } finally {
            setScanning(false);
        }
    };

    // --- Gönderme Fonksiyonu (Güncellendi) ---
    const sendToReel = async () => {
        try {
            setSending(true);
            setError("");
            clearSendState();

            if (!previewHeaders.length || !previewRows.length) {
                const msg = "Önce dosyayı tarayın. Gönderilecek satır bulunamadı.";
                setError(`❌ ${msg}`);
                setNotification({ message: msg, type: 'fail' });
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
                const msg = `Eksik kolon(lar): ${missing.join(", ")}. Lütfen "Taramayı Başlat" adımından sonra deneyin.`;
                setError(`❌ ${msg}`);
                setNotification({ message: msg, type: 'fail' });
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
                return n > 1 ? n / 100 : n;
            };
            const toPosInt = (val) => {
                const n = Number(String(val).trim());
                return Number.isFinite(n) && n > 0 ? n : null;
            };

            const endpoint = `/api/reel-api/tmsdespatchincomeexpenses/addincome`;

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
                    if (!tmsDespatchId) { details.push(`SeferID: "${rawSefer ?? ""}" → Pozitif tam sayı olmalı (örn: 12345).`); }
                    if (!currentAccountId) {
                        const isFirmId = /^\d+$/.test(String(rawCari ?? "").trim());
                        details.push(
                            isFirmId
                                ? `Cari Unvan (firma_id): "${rawCari ?? ""}" → Pozitif tam sayı (>0) olmalı.`
                                : `Cari Unvan: "${rawCari ?? ""}" → Firma adı eşleşmedi veya ID'ye çevrilemedi. Çözüm: Firma adını birebir yazın/ekleyin, sonra tekrar tarayın.`
                        );
                    }
                    if (!lineMovementType) { details.push(`Hizmet/Masraf (tip_id): "${rawHM ?? ""}" → Pozitif tam sayı olmalı. (Tarama ile otomatik dolar.)`); }
                    if (!lineMovementId) { details.push(`Hesap Adı (detay_id): "${rawHesap ?? ""}" → Pozitif tam sayı olmalı. (Eşleşmeyen "Hesap Adı" değerini kontrol edin.)`); }
                    setRowResult(r, { status: "fail", message: "Zorunlu ID alanları geçersiz.", details });
                    fail++;
                    continue;
                }

                const unitPriceNum = toNumber(row[iBirimF]);
                if (unitPriceNum == null || unitPriceNum <= 0) {
                    const details = [`Birim Fiyat: "${row[iBirimF] ?? ""}" → Sayı olmalı ve 0'dan büyük. Örn: 1250,5 veya 1250.5`];
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
                    await authorizedJson(endpoint, "POST", payload);
                    setRowResult(r, { status: "ok", message: "✅ Başarıyla Gönderildi." });
                    ok++;
                } catch (err) {
                    const msg = err?.message || "API isteği bilinmeyen bir sebeple başarısız oldu.";
                    setRowResult(r, { status: "fail", message: "API İsteği Hatası.", details: [msg] });
                    fail++;
                }
            }

            setSendSummary({ ok, fail });

            // Bildirim tetikleme
            if (fail > 0) {
                setNotification({
                    message: `Gönderim tamamlandı. ${ok} Başarılı, ${fail} Hatalı. Hata detaylarını tabloda kontrol edin.`,
                    type: 'fail'
                });
            } else {
                setNotification({
                    message: `${ok} satır başarıyla REEL sistemine eklendi.`,
                    type: 'success'
                });
            }

        } catch (e) {
            console.error(e);
            const msg = "REEL'e gönderim sırasında genel bir hata oluştu.";
            setError(`❌ ${msg}`);
            setNotification({ message: msg, type: 'fail' });
        } finally {
            setSending(false);
        }
    };

    // --- Hesaplanan Değerler (Aynı) ---
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

    const renderTotals = (val, isQuantity = false) => {
        if (!Number.isFinite(val)) return isQuantity ? "0" : "0,00";
        return val.toLocaleString("tr-TR", { minimumFractionDigits: isQuantity ? 0 : 2, maximumFractionDigits: 6 });
    };

    // --- Render ---
    return (
        <div style={STYLES.page}>
            {/* EN ÜSTTE BİLDİRİMİ GÖSTER */}
            <ToastMessage
                message={notification?.message}
                type={notification?.type}
                onClose={closeNotification}
            />

            {/* BAŞLIK VE ŞABLON İNDİR */}
            <div style={STYLES.header}>
                <h2 style={STYLES.h2}>Excel'den Gelir Ekleme 🚀</h2>
                <button
                    onClick={downloadTemplate}
                    style={{ ...STYLES.buttonBase, ...STYLES.buttonGhost }}
                >
                    <FiDownload /> Şablonu İndir (.xlsx)
                </button>
            </div>

            <div style={STYLES.card}>
                {/* 1. DROPZONE / DOSYA SEÇİMİ */}
                {!file ? (
                    <div
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            padding: '40px 20px', border: `2px dashed ${isDragging ? COLORS.primary : COLORS.border}`,
                            borderRadius: '8px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease-in-out',
                            backgroundColor: isDragging ? 'rgba(0, 123, 255, 0.05)' : 'transparent'
                        }}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={openPicker}
                        role="button"
                        tabIndex={0}
                    >
                        <FiUploadCloud size={48} style={{ color: COLORS.primary, marginBottom: '10px' }} />
                        <div style={{ fontWeight: 600, fontSize: '18px', marginBottom: '5px' }}>
                            Dosyanı buraya sürükle & bırak
                        </div>
                        <div style={{ fontSize: '14px', color: COLORS.muted }}>
                            veya <span style={{ color: COLORS.primary, textDecoration: 'underline', fontWeight: 500 }}>bilgisayardan seç</span> (.xlsx, .xls)
                        </div>
                    </div>
                ) : (
                    /* 2. SEÇİLEN DOSYA VE AKSİYONLAR */
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px', borderRadius: '8px', backgroundColor: COLORS.background
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <FiFile size={24} style={{ color: '#495057', marginRight: '15px' }} />
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '16px' }}>{file.name}</div>
                                <div style={{ fontSize: '12px', color: COLORS.muted }}>{formatSize(file.size)}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                style={{ ...STYLES.buttonBase, ...STYLES.buttonPrimary, ...(scanning || sending ? STYLES.disabled : {}) }}
                                onClick={startScan}
                                disabled={scanning || sending}
                            >
                                {scanning ? <><FiRefreshCw className="spinner" style={{ animation: 'spin 1s linear infinite' }} /> Taranıyor…</> : <><FiSearch /> Taramayı Başlat</>}
                            </button>
                            <button
                                style={{
                                    ...STYLES.buttonBase, ...STYLES.buttonSuccess,
                                    ...(sending || scanning || !previewRows.length || !!missingHeaders.length ? STYLES.disabled : {})
                                }}
                                onClick={sendToReel}
                                disabled={sending || scanning || !previewRows.length || !!missingHeaders.length}
                            >
                                {sending ? <><FiRefreshCw className="spinner" style={{ animation: 'spin 1s linear infinite' }} /> Gönderiliyor…</> : <><FiSend /> REEL'e Gönder</>}
                            </button>
                            <button
                                style={{ ...STYLES.buttonBase, ...STYLES.buttonDanger, ...(sending || scanning ? STYLES.disabled : {}) }}
                                onClick={reset}
                                disabled={sending || scanning}
                            >
                                <FiTrash2 /> Kaldır
                            </button>
                        </div>
                    </div>
                )}
            </div>

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

            {/* 3. UYARI VE ÖZET ALANLARI */}
            {error && <div style={{ ...STYLES.alertBase, ...STYLES.alertError }}><FiXCircle /> {error}</div>}

            {!!missingHeaders.length && (
                <div style={{ ...STYLES.alertBase, ...STYLES.alertWarning }}>
                    <FiAlertTriangle />
                    Eksik başlık(lar): <strong>{missingHeaders.join(", ")}</strong>
                </div>
            )}

            {previewHeaders.length > 0 && (
                <>
                    {/* ÖZET ÇUBUĞU */}
                    <div style={{
                        display: 'flex', backgroundColor: '#e9ecef', borderRadius: '8px',
                        padding: '15px', marginTop: '20px', gap: '20px', justifyContent: 'space-around'
                    }}>
                        {[{ label: "Satır Sayısı", value: previewRows.length, isQty: true },
                        { label: "Birim Fiyat Toplamı", value: simpleTotals.unitPriceSum, isQty: false },
                        { label: "Miktar Toplamı", value: simpleTotals.qtySum, isQty: true }]
                            .map((item, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                    <span style={{ fontSize: '12px', color: COLORS.muted }}>{item.label}:</span>
                                    <strong style={{ fontSize: '18px', fontWeight: 700 }}>{renderTotals(item.value, item.isQty)}</strong>
                                </div>
                            ))}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: COLORS.muted }}>Eşleşme Durumu:</span>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <span style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '4px', fontWeight: 600, backgroundColor: 'rgba(40, 167, 69, 0.2)', color: COLORS.success }}>
                                    Eşleşen: **{mapStats.matched}**
                                </span>
                                <span style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '4px', fontWeight: 600, backgroundColor: 'rgba(255, 193, 7, 0.2)', color: '#856404' }}>
                                    Bilinmeyen: **{mapStats.unknown}**
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Gönderim özeti */}
                    {sendSummary && (
                        <div style={{ ...STYLES.alertBase, ...(sendSummary.fail ? STYLES.alertError : STYLES.alertSuccess) }}>
                            {sendSummary.fail ? <FiXCircle /> : <FiCheckCircle />}
                            Gönderim tamamlandı — Başarılı: <strong>{sendSummary.ok}</strong> · Hatalı: <strong>{sendSummary.fail}</strong>
                        </div>
                    )}
                </>
            )}

            {/* 4. ÖNİZLEME TABLOSU */}
            {previewHeaders.length > 0 && (
                <div style={{
                    marginTop: '20px', background: COLORS.cardBackground, borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', padding: '15px'
                }}>
                    {/* Hatalı satır listesi*/}
                    {Object.entries(rowResults).some(([, v]) => v?.status === "fail") && (
                        <div style={{
                            backgroundColor: 'rgba(220, 53, 69, 0.1)', border: `1px solid ${COLORS.danger}`,
                            color: COLORS.danger, padding: '15px', borderRadius: '8px', marginBottom: '20px',
                            fontSize: '14px', display: 'flex', gap: '10px', alignItems: 'flex-start'
                        }}>
                            <FiAlertTriangle size={20} style={{ flexShrink: 0 }} />
                            <div>
                                <strong>Hata Detayları:</strong>
                                <ul style={{ listStyleType: 'none', paddingLeft: 0, marginTop: '10px', marginBottom: 0 }}>
                                    {Object.entries(rowResults)
                                        .filter(([, v]) => v?.status === "fail")
                                        .map(([idx, v]) => {
                                            const excelRow = Number(idx) + 2;
                                            return (
                                                <li key={idx} style={{ marginBottom: '5px' }}>
                                                    **Satır {excelRow}**: {v?.message || "Bilinmeyen hata"}
                                                    {Array.isArray(v?.details) && v.details.length > 0 && (
                                                        <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: '5px 0 0 0', color: COLORS.muted, fontSize: '13px' }}>
                                                            {v.details.map((d, i) => <li key={i}>{d}</li>)}
                                                        </ul>
                                                    )}
                                                </li>
                                            );
                                        })}
                                </ul>
                            </div>
                        </div>
                    )}

                    <div style={{ maxHeight: '500px', overflow: 'auto', marginTop: '15px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr>
                                    {previewHeaders.map((h, i) => (
                                        <th
                                            key={i}
                                            style={{
                                                backgroundColor: missingHeaders.includes(h) ? COLORS.danger : '#f1f1f1',
                                                color: missingHeaders.includes(h) ? 'white' : COLORS.text,
                                                padding: '12px 15px',
                                                textAlign: 'left',
                                                position: 'sticky',
                                                top: 0,
                                                zIndex: 10,
                                                borderBottom: `2px solid ${COLORS.border}`
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {previewRows.map((row, rIdx) => {
                                    const rr = rowResults[rIdx];
                                    let rowBg = '#fff';
                                    let rowColor = COLORS.text;

                                    if (rr?.status === "fail") {
                                        rowBg = 'rgba(220, 53, 69, 0.15)';
                                        rowColor = COLORS.danger;
                                    } else if (rr?.status === "ok") {
                                        rowBg = 'rgba(40, 167, 69, 0.1)';
                                    }

                                    return (
                                        <tr
                                            key={rIdx}
                                            title={rr?.message || ""}
                                            style={{
                                                backgroundColor: rowBg,
                                                color: rowColor,
                                                transition: 'background-color 0.1s',
                                            }}
                                        >
                                            {previewHeaders.map((_, cIdx) => (
                                                <td
                                                    key={cIdx}
                                                    style={{
                                                        padding: '10px 15px',
                                                        borderBottom: `1px solid ${COLORS.background}`,
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {row[cIdx] ?? ""}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}