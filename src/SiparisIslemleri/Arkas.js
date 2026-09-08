import React, { useMemo, useRef, useState } from "react";
import { Link as LinkIcon, ListChecks, FileSpreadsheet, UploadCloud, Loader2, X, FileCheck2, Route, Sparkles, Download, RotateCcw, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import supabase from "../supabaseClient";
import "./Arkas.css";

/** ===================== SABİTLER ===================== */
const HEADERS = [
    "Vkn", "Proje", "Sipariş Tarihi", "Yükleme Tarihi", "Teslim Tarihi", "Müşteri Sipariş No",
    "Müşteri Referans No", "İstenilen Araç Tipi", "Açıklama", "Yükleme Firması Adı", "Alıcı Firma Cari Adı",
    "Teslim Firma Adres Adı", "İrsaliye No", "İrsaliye Miktarı", "Ürün", "Kap Adet", "Ambalaj  Tipi", "Brüt KG", "M3", "Desi",
];

const REQUIRED_EXPORT_HEADERS = [
    "Sipariş Tarihi", "Müşteri Sipariş No", "İstenilen Araç Tipi", "Açıklama",
    "Yükleme Firma Adı", "Alıcı Firma Cari Adı", "Teslim Firma Adres Adı",
].map((h) => h.replace("Yükleme Firma Adı", "Yükleme Firması Adı"));

/** ===================== YARDIMCILAR ===================== */
const emptyRow = () => HEADERS.reduce((acc, k) => ({ ...acc, [k]: "" }), {});
const normalize = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const toShortTR = (d) => (d ? d.toLocaleDateString("tr-TR") : "");
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

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
const enrichVehicleOnRow = (row) => ({ ...row, ["İstenilen Araç Tipi"]: mapVehicleTypeToCode(row["İstenilen Araç Tipi"]) });

/* Fuzzy yardımcılar */
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
    const A = bigrams(a), B = bigrams(b);
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

/** ===================== ANA BİLEŞEN ===================== */
export default function ArkasEkrani() {
    const [rows, setRows] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState("");
    const [lastFile, setLastFile] = useState(null);
    const [overlayLoading, setOverlayLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStage, setUploadStage] = useState("");
    const fileInputRef = useRef(null);
    const columns = useMemo(() => HEADERS, []);

    /* Eşleşme paneli state */
    const [matchModalOpen, setMatchModalOpen] = useState(false);
    const [matchPreview, setMatchPreview] = useState({
        total: 0, matchedCount: 0, unmatchedCount: 0, matchedSamples: [], unmatchedSamples: [],
    });
    const [matchResults, setMatchResults] = useState([]);

    /* Adres kataloğu (Supabase’ten) */
    const [adresCatalog, setAdresCatalog] = useState([]);

    /* Manuel seçim modali */
    const [selOpen, setSelOpen] = useState(false);
    const [selRowIndex, setSelRowIndex] = useState(null);
    // Eski tek alan: selQuery — artık gerekmiyor ama istersen tutabilirsin:
    const [selQuery, setSelQuery] = useState("");
    const [selLoading, setSelLoading] = useState(false);
    const [selResults, setSelResults] = useState([]);
    const [selTotal, setSelTotal] = useState(0);
    const [selPage, setSelPage] = useState(1);

    // Yeni: ayrı filtreler
    const [adresFilter, setAdresFilter] = useState("");
    const [cariFilter, setCariFilter] = useState("");
    const selDebounceRef = useRef(null);

    const SEL_PAGE_SIZE = 50;
    const queueSelSearch = (nextAdres, nextCari, delay = 350) => {
        if (selDebounceRef.current) clearTimeout(selDebounceRef.current);
        selDebounceRef.current = setTimeout(() => {
            runAddressSearch(nextAdres, nextCari);
        }, delay);
    };

    const isExcelFile = (file) =>
        /\.(xlsx|xlsm|xls)$/i.test(file.name) ||
        [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ].includes(file.type);

    // Ton'u sayıya çevir (TR/EN ayracı güvenli)
    const parseTon = (v) => {
        if (v === null || v === undefined || v === "") return 0;
        if (typeof v === "number" && isFinite(v)) return v;
        let s = String(v).trim();
        if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
        else if (s.includes(",")) s = s.replace(",", ".");
        const n = Number(s);
        return isFinite(n) ? n : 0;
    };

    // 1000 çarpıp TR binlik format (7,5 -> "7.500")
    const toKgStr = (ton) => {
        const kg = Math.round(ton * 1000);
        return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(kg);
    };

    const parseExcel = async (file) => {
        setError("");
        try {
            if (!isExcelFile(file)) throw new Error("Lütfen .xlsx / .xls dosyası yükleyin.");

            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
            if (!aoa || aoa.length === 0) throw new Error("Boş sayfa görünüyor.");

            const [rawHeaders, ...body] = aoa;

            // Başlık eşleştirme yardımcıları
            const eqHeader = (a, b) => normalize(a).toLocaleUpperCase("tr") === normalize(b).toLocaleUpperCase("tr");
            const findHeader = (headers, variants) => headers.findIndex((h) => variants.some((v) => eqHeader(h, v)));

            // Tarihler
            const today = new Date();
            const tomorrow = addDays(today, 1);
            const dToday = toShortTR(today);
            const dTomorrow = toShortTR(tomorrow);

            // Legacy kolonlar (B,C,E,F)
            const idxB = findHeader(rawHeaders, ["Müşteri Adı", "MÜŞTERİ ADI", "Musteri Adi"]);
            const idxC = findHeader(rawHeaders, ["Adres", "ADRES", "Teslim Adresi"]);
            const idxE = findHeader(rawHeaders, ["Araç adedi", "ARAÇ ADEDİ", "Arac adedi", "Araç Adedi"]);
            const idxF = findHeader(rawHeaders, ["Müşteri Sipariş No", "Müşteri No", "MUSTERI NO", "Musteri No"]);

            const legacyDetected = idxB >= 0 || idxC >= 0;
            const headerless = idxB === -1 && idxC === -1;

            // === 1) LEGACY / BAŞLIKSIZ (B=2, C=3, E=5, F=6) ===
            if (legacyDetected || headerless) {
                // Başlıksızsa ilk satır başlık gibiyse atla
                let start = 0;
                if (headerless) {
                    const b0 = normalize(aoa?.[0]?.[1] || "");
                    const c0 = normalize(aoa?.[0]?.[2] || "");
                    if (/müşteri|musteri/i.test(b0) || /adres/i.test(c0)) start = 1;
                }

                let lastB = "", lastC = "";
                const srcRows = legacyDetected ? body : aoa.slice(start);
                const outRows = [];

                // Grup takibi (E boş = devam satırı)
                let groupHeadIdx = -1;
                let groupSumTon = 0;
                let groupFirstF = "";
                let groupFirstTon = 0;

                const closeGroup = () => {
                    if (groupHeadIdx === -1) return;
                    const code = groupSumTon <= 13.99 ? "3" : "1";
                    outRows[groupHeadIdx]["İstenilen Araç Tipi"] = code;
                    outRows[groupHeadIdx]["Müşteri Referans No"] = groupFirstF;
                    outRows[groupHeadIdx]["Brüt KG"] = toKgStr(groupFirstTon);
                    groupHeadIdx = -1;
                    groupSumTon = 0;
                    groupFirstF = "";
                    groupFirstTon = 0;
                };

                for (const row of srcRows) {
                    if (!row || !row.some((cell) => normalize(cell) !== "")) continue;

                    const ton = parseTon(row[0]); // A = Ton
                    const bRaw = normalize((idxB >= 0 ? row[idxB] : row[1]) ?? ""); // B
                    const cRaw = normalize((idxC >= 0 ? row[idxC] : row[2]) ?? ""); // C
                    const eRaw = normalize((idxE >= 0 ? row[idxE] : row[4]) ?? ""); // E
                    const fRaw = normalize((idxF >= 0 ? row[idxF] : row[5]) ?? ""); // F

                    const isMerged = eRaw === ""; // E boşsa continuation

                    // B/C forward-fill
                    const b = bRaw || lastB;
                    const c = cRaw || lastC;
                    if (b) lastB = b;
                    if (c) lastC = c;

                    const obj = emptyRow();

                    // Sabit/dolu alanlar
                    obj["Yükleme Firması Adı"] = "13";
                    obj["Alıcı Firma Cari Adı"] = b;   // B
                    obj["Teslim Firma Adres Adı"] = c; // C
                    obj["Ürün"] = "2";
                    obj["Kap Adet"] = "1";
                    obj["Ambalaj  Tipi"] = "1";

                    if (isMerged) {
                        // E boşsa şu kolonlar boş:
                        obj["Vkn"] = "";
                        obj["Proje"] = "";
                        obj["Sipariş Tarihi"] = "";
                        obj["Yükleme Tarihi"] = "";
                        obj["Teslim Tarihi"] = "";
                        obj["Müşteri Sipariş No"] = "";
                        obj["Müşteri Referans No"] = "";
                        obj["İstenilen Araç Tipi"] = "";
                        obj["Açıklama"] = "";
                        obj["Brüt KG"] = ""; // sadece grup başında dolacak
                        groupSumTon += ton;
                    } else {
                        // varsa önceki grubu kapat
                        closeGroup();
                        // Grup başı
                        obj["Vkn"] = "079002095";
                        obj["Proje"] = "458";
                        obj["Müşteri Sipariş No"] = fRaw;
                        obj["Sipariş Tarihi"] = dToday;
                        obj["Yükleme Tarihi"] = dToday;
                        obj["Teslim Tarihi"] = dTomorrow;
                        obj["İstenilen Araç Tipi"] = "";
                        obj["Müşteri Referans No"] = "";
                        obj["Brüt KG"] = "";

                        groupHeadIdx = outRows.length;
                        groupSumTon = ton;
                        groupFirstTon = ton;
                        if (!groupFirstF && fRaw) groupFirstF = fRaw;
                    }

                    outRows.push(enrichVehicleOnRow(obj));
                }

                // Dosya sonu
                closeGroup();

                setRows(outRows);
                setLastFile(file);
                return;
            }

            // === 2) STANDART ŞABLON ===
            const headerIndexMap = {};
            HEADERS.forEach((h) => {
                const idx = rawHeaders.findIndex((x) => normalize(x) === normalize(h));
                headerIndexMap[h] = idx; // -1 olabilir
            });

            const parsedRows = body
                .filter((row) => row.some((cell) => normalize(cell) !== ""))
                .map((row) => {
                    const obj = emptyRow();
                    HEADERS.forEach((h) => {
                        const idx = headerIndexMap[h];
                        obj[h] = idx >= 0 ? normalize(row[idx]) : "";
                    });
                    // Sabitler ve tarihler
                    obj["Vkn"] = "079002095";
                    obj["Proje"] = "458";
                    obj["Yükleme Firması Adı"] = "13";
                    obj["Ürün"] = "2";
                    obj["Kap Adet"] = "1";
                    obj["Ambalaj  Tipi"] = "1";
                    obj["Sipariş Tarihi"] = dToday;
                    obj["Yükleme Tarihi"] = dToday;
                    obj["Teslim Tarihi"] = dTomorrow;
                    return enrichVehicleOnRow(obj);
                });

            setRows(parsedRows);
            setLastFile(file);
        } catch (e) {
            setRows([]);
            setError(e.message || "Excel okunamadı.");
        }
    };

    // Drag & drop
    const processExcelWithFeedback = async (file) => {
        setUploadLoading(true);
        setUploadProgress(12);
        setUploadStage("Dosya okunuyor");
        const timer = setInterval(() => {
            setUploadProgress((p) => {
                if (p >= 88) return p;
                const next = Math.min(88, p + Math.max(4, Math.round((92 - p) * 0.12)));
                if (next > 60) setUploadStage("Sipariş satırları hazırlanıyor");
                else if (next > 32) setUploadStage("Excel yapısı doğrulanıyor");
                return next;
            });
        }, 160);
        try {
            await parseExcel(file);
            setUploadStage("Dosya hazır");
            setUploadProgress(100);
            await new Promise((r) => setTimeout(r, 320));
        } finally {
            clearInterval(timer);
            setUploadLoading(false);
            setTimeout(() => { setUploadProgress(0); setUploadStage(""); }, 250);
        }
    };

    const onDrop = (e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) processExcelWithFeedback(f); };
    const onDragOver = (e) => { e.preventDefault(); setDragActive(true); };
    const onDragLeave = () => setDragActive(false);
    const onFileChange = (e) => { const f = e.target.files?.[0]; if (f) processExcelWithFeedback(f); e.target.value = ""; };

    /** --- DIŞA AKTAR --- */
    const handleExportExcel = () => {
        if (!rows.length) { setError("Dışa aktarılacak veri bulunamadı."); return; }
        const cols = [...columns];
        const aoa = [cols, ...rows.map((r) => columns.map((c) => r[c] ?? ""))];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tablo");
        const iso = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Siparisler_${iso}.xlsx`);
    };

    // ---- FUZZY skor kombinasyonu ----
    const TR_STOP = new Set(["mah", "mah.", "no", "no.", "sk", "sk.", "sok", "sokağı", "cad", "cad.", "caddesi", "bulv", "bulv.", "bulvar", "san", "san.", "osb", "organize", "sanayi", "merkez", "ilçe", "il", "apt", "ap.", "kat", "daire", "d.", "köy", "beldesi", "mevkii", "mevkisi", "toki", "site", "blok", "bl.", "blv"]);
    const wordTokens = (s) => cleanAddr(s).split(" ").filter((w) => w && !TR_STOP.has(w));
    const jaccard = (A, B) => { const a = new Set(A), b = new Set(B); if (!a.size && !b.size) return 0; let inter = 0; for (const x of a) if (b.has(x)) inter++; return inter / (a.size + b.size - inter); };
    const ngramDice = (a, b) => diceCoefficient(cleanAddr(a), cleanAddr(b));
    const combinedScore = (a, b) => 0.6 * jaccard(wordTokens(a), wordTokens(b)) + 0.4 * ngramDice(a, b);

    const STRONG_MATCH = 0.86;   // otomatik eşleştir
    const SHOW_SUGGEST = 0.70;   // öneri eşiği
    const TOP_N = 5;

    /* --- EŞLEŞME YAP (fuzzy + panel) --- */
    const handleEslesmeYap = async () => {
        try {
            if (!rows.length) { setError("Eşleşme için önce Excel yükleyin."); return; }
            setError("");
            setOverlayLoading(true);

            const key = (s) => String(s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr");

            // 1) Toplam kayıt sayısı
            const pageSize = 1000;
            const { count, error: countError } = await supabase.from("Teslim_Noktalari").select("*", { count: "exact", head: true });
            if (countError) throw countError;

            // 2) Sayfalı çek
            const total = count || 0;
            let allAdresler = [];
            for (let from = 0; from < total; from += pageSize) {
                const to = from + pageSize - 1;
                const { data, error } = await supabase.from("Teslim_Noktalari").select("adres_id, adres_adi, cari_hesap_id").range(from, to);
                if (error) throw error;
                allAdresler = allAdresler.concat(data || []);
            }
            setAdresCatalog(allAdresler); // manuel seçim modali için sakla

            // 3) Birebir eşleşme için map
            const byAdresExact = new Map();
            for (const a of allAdresler) {
                const k = key(a?.adres_adi ?? "");
                if (k) byAdresExact.set(k, {
                    adres_id: String(a?.adres_id ?? ""),
                    adres_adi: String(a?.adres_adi ?? ""),
                    cari_hesap_id: String(a?.cari_hesap_id ?? ""),
                });
            }

            // 4) Aday liste (fuzzy)
            const candidates = allAdresler.map((a) => ({
                adres_id: String(a?.adres_id ?? ""),
                adres_adi: String(a?.adres_adi ?? ""),
                cari_hesap_id: String(a?.cari_hesap_id ?? ""),
            }));

            // 5) Satır bazında eşleştirme
            const results = rows.map((row, rowIndex) => {
                const qRaw = row["Teslim Firma Adres Adı"] || "";
                const exact = byAdresExact.get(key(qRaw));
                if (exact) {
                    return { rowIndex, ok: true, before: qRaw, matchedAdresAdi: exact.adres_adi, matchedAdresId: exact.adres_id, matchedCariId: exact.cari_hesap_id, score: 1, suggestions: [] };
                }
                const scored = candidates.map((c) => ({ ...c, _score: combinedScore(qRaw, c.adres_adi) }));
                const suggestions = scored
                    .filter((x) => x._score >= SHOW_SUGGEST)
                    .sort((a, b) => b._score - a._score)
                    .slice(0, TOP_N)
                    .map((s) => ({ adres_adi: s.adres_adi, adres_id: s.adres_id, cari_hesap_id: s.cari_hesap_id, score: Number(s._score.toFixed(2)) }));

                const top = scored.sort((a, b) => b._score - a._score)[0];
                if (top && top._score >= STRONG_MATCH) {
                    return { rowIndex, ok: true, before: qRaw, matchedAdresAdi: top.adres_adi, matchedAdresId: top.adres_id, matchedCariId: top.cari_hesap_id, score: Number(top._score.toFixed(2)), suggestions };
                }

                return { rowIndex, ok: false, before: qRaw, score: 0, suggestions };
            });

            const matched = results.filter((r) => r.ok);
            const unmatched = results.filter((r) => !r.ok);

            setMatchResults(results);
            setMatchPreview({
                total: rows.length,
                matchedCount: matched.length,
                unmatchedCount: unmatched.length,
                matchedSamples: matched.slice(0, 20).map((r) => ({
                    rowIndex: r.rowIndex, before: r.before, matchedAdresAdi: r.matchedAdresAdi, matchedAdresId: r.matchedAdresId, matchedCariId: r.matchedCariId,
                })),
                unmatchedSamples: unmatched.slice(0, 20).map((r) => ({
                    rowIndex: r.rowIndex, before: r.before || "—", suggestions: r.suggestions || [],
                })),
            });
            setMatchModalOpen(true);
        } catch (e) {
            setError(e.message || "Eşleşme sırasında hata oluştu.");
        } finally {
            setOverlayLoading(false);
        }
    };

    /* Manuel eşleştirme: arama & seç — iki ayrı filtreli */
    const runAddressSearch = async (adresQ = "", cariQ = "") => {
        setSelLoading(true);
        try {
            const aQ = normalize(adresQ).toLocaleLowerCase("tr");
            const cQ = normalize(cariQ).toLocaleLowerCase("tr");

            // Önce "cari" kolonu var kabul ederek sorgula
            let rq = supabase
                .from("Teslim_Noktalari")
                .select("adres_id, adres_adi, cari, cari_hesap_id")
                .order("adres_adi", { ascending: true })
                .limit(100);
            if (aQ) rq = rq.ilike("adres_adi", `%${aQ}%`);
            if (cQ) rq = rq.ilike("cari", `%${cQ}%`);

            let { data, error } = await rq;

            // "cari" kolonu yoksa fallback: sadece adres_adi ile ara, cari boş gelir
            if (error && /column .*cari/i.test(String(error.message || ""))) {
                rq = supabase
                    .from("Teslim_Noktalari")
                    .select("adres_id, adres_adi, cari_hesap_id")
                    .order("adres_adi", { ascending: true })
                    .limit(100);
                if (aQ) rq = rq.ilike("adres_adi", `%${aQ}%`);
                ({ data, error } = await rq);
                if (error) throw error;
                data = (data || []).map(d => ({ ...d, cari: null }));
            } else if (error) {
                throw error;
            }

            setSelResults(
                (data || []).map(a => ({
                    adres_id: String(a?.adres_id ?? ""),
                    adres_adi: String(a?.adres_adi ?? ""),
                    cari_hesap_id: String(a?.cari_hesap_id ?? ""),
                    cari: a?.cari ?? "",
                }))
            );
        } catch (e) {
            setError(e.message || "Adres ararken hata oluştu.");
            setSelResults([]);
        } finally {
            setSelLoading(false);
        }
    };

    const openSelector = (rowIndex, initialQuery = "") => {
        setSelRowIndex(rowIndex);
        setSelQuery(initialQuery || ""); // artık kullanılmıyor ama dursun
        // filtreleri başlangıçta setle
        setAdresFilter(initialQuery || "");
        setCariFilter("");
        setSelOpen(true);
        runAddressSearch(initialQuery || "", "");
    };

    const applySelection = (sel) => {
        // Satırı güncelle
        setRows((prev) =>
            prev.map((r, i) =>
                i === selRowIndex
                    ? { ...r, ["Teslim Firma Adres Adı"]: String(sel.adres_id), ["Alıcı Firma Cari Adı"]: String(sel.cari_hesap_id) }
                    : r
            )
        );

        // matchResults & preview'ü güncelle
        setMatchResults((prev) => {
            const arr = prev.map((r) =>
                r.rowIndex === selRowIndex
                    ? { rowIndex: r.rowIndex, ok: true, before: r.before, matchedAdresAdi: sel.adres_adi, matchedAdresId: String(sel.adres_id), matchedCariId: String(sel.cari_hesap_id), score: 1, suggestions: [] }
                    : r
            );
            const matched = arr.filter((x) => x.ok);
            const unmatched = arr.filter((x) => !x.ok);
            setMatchPreview({
                total: rows.length,
                matchedCount: matched.length,
                unmatchedCount: unmatched.length,
                matchedSamples: matched.slice(0, 20).map((r) => ({
                    rowIndex: r.rowIndex, before: r.before, matchedAdresAdi: r.matchedAdresAdi, matchedAdresId: r.matchedAdresId, matchedCariId: r.matchedCariId,
                })),
                unmatchedSamples: unmatched.slice(0, 20).map((r) => ({
                    rowIndex: r.rowIndex, before: r.before || "—", suggestions: r.suggestions || [],
                })),
            });
            return arr;
        });

        setSelOpen(false);
    };

    const confirmApplyMatches = () => {
        setRows((prev) => {
            const byIndex = new Map();
            for (const r of matchResults) if (r.ok) byIndex.set(r.rowIndex, r);
            return prev.map((row, i) => {
                const m = byIndex.get(i);
                if (!m) return row;
                const next = { ...row };
                next["Teslim Firma Adres Adı"] = String(m.matchedAdresId ?? "");
                next["Alıcı Firma Cari Adı"] = String(m.matchedCariId ?? "");
                return next;
            });
        });
        setMatchModalOpen(false);
    };

    const handleTemizle = () => {
        setRows([]); setLastFile(null); setError("");
        setMatchResults([]); setMatchPreview({ total: 0, matchedCount: 0, unmatchedCount: 0, matchedSamples: [], unmatchedSamples: [] });
        setMatchModalOpen(false); setSelOpen(false);
    };

    /** ===================== UI ===================== */
    return (
        <div className="arkas-page ots-page">
            <section className="arkas-hero">
                <div className="arkas-hero-main">
                    <span className="arkas-hero-icon">
                        <FileSpreadsheet size={24} strokeWidth={1.9} />
                    </span>
                    <div>
                        <span className="arkas-eyebrow">Sipariş İşlemleri</span>
                        <h2>Arkas — Sipariş Oluştur</h2>
                        <p>
                            Excel siparişlerini içeri alın, adresleri sistem kayıtlarıyla
                            eşleştirin ve standart sipariş formatında dışarı aktarın.
                        </p>
                    </div>
                </div>

                <div className="arkas-hero-actions">
                    <button
                        type="button"
                        onClick={handleEslesmeYap}
                        disabled={!rows.length || overlayLoading}
                        className="arkas-btn arkas-btn-secondary"
                    >
                        {overlayLoading ? (
                            <Loader2 className="arkas-spin" size={16} />
                        ) : (
                            <LinkIcon size={16} />
                        )}
                        {overlayLoading ? "Eşleştiriliyor..." : "Eşleşme Yap"}
                    </button>

                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={!rows.length}
                        className="arkas-btn arkas-btn-primary"
                    >
                        <FileSpreadsheet size={16} />
                        Dışarı Aktar
                    </button>
                </div>
            </section>

            <section className="arkas-flow" aria-label="Arkas sipariş iş akışı">
                <div className={`arkas-flow-step ${rows.length ? "is-complete" : "is-active"}`}>
                    <span><UploadCloud size={16} /></span>
                    <div><b>1. Excel Yükle</b><small>Arkas şablonunu içeri al</small></div>
                </div>
                <i />
                <div className={`arkas-flow-step ${rows.length && !overlayLoading ? "is-active" : ""} ${matchResults.length ? "is-complete" : ""}`}>
                    <span><Route size={16} /></span>
                    <div><b>2. Adresleri Eşleştir</b><small>Sistem kayıtlarıyla doğrula</small></div>
                </div>
                <i />
                <div className={`arkas-flow-step ${matchResults.length ? "is-active" : ""}`}>
                    <span><Download size={16} /></span>
                    <div><b>3. Dışarı Aktar</b><small>Standart sipariş dosyasını üret</small></div>
                </div>
            </section>

            <section className="arkas-card">
                <div className="arkas-card-header">
                    <div className="arkas-card-title">
                        <span className="arkas-card-icon">
                            <ListChecks size={17} />
                        </span>
                        <div>
                            <strong>Arkas Excel Şablonu</strong>
                            <span>
                                Legacy: B → Alıcı, C → Teslim, F → Müşteri Sipariş No
                            </span>
                        </div>
                    </div>

                    <div className="arkas-fixed-values">
                        <span>VKN <b>079002095</b></span>
                        <span>Proje <b>458</b></span>
                        <span>Yükleme <b>13</b></span>
                    </div>
                </div>

                <div
                    className="arkas-import-area"
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDragEnd={onDragLeave}
                    onDragExit={onDragLeave}
                >
                    {rows.length === 0 ? (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={`arkas-dropzone ${dragActive ? "is-dragging" : ""}`}
                            aria-label="Excel sürükleyip bırak veya tıklayıp seç"
                        >
                            {uploadLoading ? (
                                <>
                                    <span className="arkas-dropzone-icon is-loading">
                                        <Loader2 size={30} className="arkas-spin" />
                                    </span>
                                    <strong>{uploadStage || "Excel işleniyor"}</strong>
                                    <span>Dosyanız sipariş formatına hazırlanıyor...</span>
                                    <div className="arkas-upload-progress"><span style={{ width: `${uploadProgress}%` }} /></div>
                                    <small className="arkas-upload-percent">%{uploadProgress}</small>
                                </>
                            ) : (
                                <>
                                    <span className="arkas-dropzone-icon">
                                        <UploadCloud size={32} strokeWidth={1.7} />
                                    </span>
                                    <strong>Excel dosyasını buraya bırakın</strong>
                                    <span>veya tıklayarak .xlsx / .xls dosyası seçin</span>
                                    <div className="arkas-dropzone-tags">
                                        <span>.XLSX</span>
                                        <span>.XLS</span>
                                        <span>.XLSM</span>
                                    </div>
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="arkas-table-scroll">
                            <table className="arkas-table">
                                <thead>
                                    <tr>
                                        <th className="arkas-row-index">#</th>
                                        {columns.map((c) => (
                                            <th key={c}>{c}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, rowIdx) => (
                                        <tr key={rowIdx}>
                                            <td className="arkas-row-index">{rowIdx + 1}</td>
                                            {columns.map((col) => (
                                                <td key={`${rowIdx}-${col}`} title={row[col]}>
                                                    <span>{row[col] || "-"}</span>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.xlsm"
                        onChange={onFileChange}
                        hidden
                    />
                </div>

                {error && (
                    <div className="arkas-alert arkas-alert-error">
                        <X size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {lastFile && (
                    <div className="arkas-file-info">
                        <span>Yüklü dosya</span>
                        <strong>{lastFile.name}</strong>
                    </div>
                )}

                <div className="arkas-card-footer">
                    <p>
                        Excel yüklendikten sonra <b>Eşleşme Yap</b> ile teslim adreslerini
                        sistemdeki adres kayıtlarıyla kontrol edebilirsiniz.
                    </p>

                    <button
                        type="button"
                        onClick={handleTemizle}
                        disabled={!rows.length && !lastFile && !error}
                        className="arkas-btn arkas-btn-danger"
                    >
                        <RotateCcw size={15} />
                        Temizle
                    </button>
                </div>
            </section>

            {matchModalOpen && (
                <div className="arkas-modal-backdrop" role="dialog" aria-modal="true">
                    <div className="arkas-modal arkas-modal-wide">
                        <div className="arkas-modal-header">
                            <div>
                                <span className="arkas-eyebrow">Adres Eşleştirme</span>
                                <h3>Eşleşme Özeti</h3>
                            </div>

                            <div className="arkas-summary-badges">
                                <span className="neutral">Toplam <b>{matchPreview.total}</b></span>
                                <span className="success">Eşleşen <b>{matchPreview.matchedCount}</b></span>
                                <span className="danger">Eşleşmeyen <b>{matchPreview.unmatchedCount}</b></span>
                            </div>
                        </div>

                        <div className="arkas-match-grid">
                            <section className="arkas-match-panel">
                                <div className="arkas-match-panel-header">
                                    <strong>Eşleşenler</strong>
                                    <span>{matchPreview.matchedCount}</span>
                                </div>

                                <div className="arkas-match-list">
                                    {matchPreview.matchedSamples?.length ? (
                                        matchPreview.matchedSamples.map((s) => (
                                            <article key={`m-${s.rowIndex}`} className="arkas-match-item">
                                                <span className="arkas-match-label">Excel Adresi</span>
                                                <strong>{s.before}</strong>

                                                <span className="arkas-match-label arkas-match-spacer">
                                                    Sistem Adresi
                                                </span>
                                                <strong>{s.matchedAdresAdi}</strong>

                                                <div className="arkas-id-row">
                                                    <span>adres_id: {s.matchedAdresId}</span>
                                                    <span>cari_hesap_id: {s.matchedCariId}</span>
                                                </div>
                                            </article>
                                        ))
                                    ) : (
                                        <div className="arkas-empty-small">Eşleşen kayıt yok.</div>
                                    )}
                                </div>
                            </section>

                            <section className="arkas-match-panel">
                                <div className="arkas-match-panel-header danger">
                                    <strong>Eşleşmeyenler</strong>
                                    <span>{matchPreview.unmatchedCount}</span>
                                </div>

                                <div className="arkas-match-list">
                                    {matchPreview.unmatchedSamples?.length ? (
                                        matchPreview.unmatchedSamples.map((s) => (
                                            <article key={`u-${s.rowIndex}`} className="arkas-match-item">
                                                <span className="arkas-match-label">Excel Adresi</span>
                                                <strong>{s.before}</strong>

                                                <span className="arkas-match-label arkas-match-spacer">Öneriler</span>

                                                {s.suggestions?.length ? (
                                                    <div className="arkas-suggestions">
                                                        {s.suggestions.map((sg) => (
                                                            <div key={sg.adres_id}>
                                                                <span>{sg.adres_adi}</span>
                                                                <small>Skor {sg.score}</small>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="arkas-no-suggestion">Uygun öneri yok</span>
                                                )}

                                                <button
                                                    type="button"
                                                    className="arkas-btn arkas-btn-secondary arkas-btn-small"
                                                    onClick={() => openSelector(s.rowIndex, s.before)}
                                                >
                                                    Manuel Eşleştir
                                                </button>
                                            </article>
                                        ))
                                    ) : (
                                        <div className="arkas-empty-small">Tüm kayıtlar eşleşti.</div>
                                    )}
                                </div>
                            </section>
                        </div>

                        <div className="arkas-modal-footer">
                            <button
                                type="button"
                                className="arkas-btn arkas-btn-secondary"
                                onClick={() => setMatchModalOpen(false)}
                            >
                                Vazgeç
                            </button>
                            <button
                                type="button"
                                className="arkas-btn arkas-btn-primary"
                                onClick={confirmApplyMatches}
                            >
                                <CheckCircle2 size={16} />
                                Onayla ve Uygula
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selOpen && (
                <div className="arkas-modal-backdrop arkas-modal-top" role="dialog" aria-modal="true">
                    <div className="arkas-modal arkas-selector-modal">
                        <div className="arkas-modal-header">
                            <div>
                                <span className="arkas-eyebrow">Manuel Eşleştirme</span>
                                <h3>Adres Seç — Satır #{(selRowIndex ?? 0) + 1}</h3>
                            </div>
                            <button
                                type="button"
                                className="arkas-btn arkas-btn-secondary arkas-btn-small"
                                onClick={() => setSelOpen(false)}
                            >
                                Kapat
                            </button>
                        </div>

                        <div className="arkas-selector-body">
                            <div className="arkas-filter-grid">
                                <input
                                    className="arkas-input"
                                    placeholder="Adres adı filtrele..."
                                    value={adresFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setAdresFilter(v);
                                        queueSelSearch(v, cariFilter);
                                    }}
                                />

                                <input
                                    className="arkas-input"
                                    placeholder="Cari filtrele..."
                                    value={cariFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setCariFilter(v);
                                        queueSelSearch(adresFilter, v);
                                    }}
                                />

                                <div className="arkas-filter-actions">
                                    <button
                                        type="button"
                                        className="arkas-btn arkas-btn-primary arkas-btn-small"
                                        onClick={() => runAddressSearch(adresFilter, cariFilter)}
                                    >
                                        {selLoading && <Loader2 size={15} className="arkas-spin" />}
                                        Ara
                                    </button>
                                    <button
                                        type="button"
                                        className="arkas-btn arkas-btn-secondary arkas-btn-small"
                                        onClick={() => {
                                            setAdresFilter("");
                                            setCariFilter("");
                                            runAddressSearch("", "");
                                        }}
                                    >
                                        Temizle
                                    </button>
                                </div>
                            </div>

                            <div className="arkas-selector-table-wrap">
                                <table className="arkas-selector-table">
                                    <thead>
                                        <tr>
                                            <th>Adres Adı</th>
                                            <th>Cari</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selResults.map((it) => (
                                            <tr key={it.adres_id}>
                                                <td>{it.adres_adi}</td>
                                                <td>{it.cari || "—"}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="arkas-btn arkas-btn-primary arkas-btn-small"
                                                        onClick={() => applySelection(it)}
                                                    >
                                                        Seç
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}

                                        {selLoading && (
                                            <tr>
                                                <td colSpan={3} className="arkas-selector-status">
                                                    <Loader2 size={16} className="arkas-spin" />
                                                    Yükleniyor...
                                                </td>
                                            </tr>
                                        )}

                                        {!selLoading && selResults.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="arkas-selector-status">
                                                    Sonuç yok.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
