import React, { useMemo, useRef, useState } from "react";
import { Link as LinkIcon, ListChecks, FileSpreadsheet, UploadCloud, Loader2, X } from "lucide-react";
import * as XLSX from "xlsx";
import supabase from "../supabaseClient";

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
    const onDrop = (e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) parseExcel(f); };
    const onDragOver = (e) => { e.preventDefault(); setDragActive(true); };
    const onDragLeave = () => setDragActive(false);
    const onFileChange = (e) => { const f = e.target.files?.[0]; if (f) parseExcel(f); e.target.value = ""; };

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
        <div className="p-4 space-y-3">
            {/* HEADER */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Arkas — Sipariş Oluştur</h1>
                    <div className="text-xs text-gray-500">ArkasEkrani.jsx</div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleEslesmeYap} disabled={!rows.length || overlayLoading} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border hover:bg-gray-50 disabled:opacity-50">
                        {overlayLoading ? <Loader2 className="animate-spin" size={16} /> : <LinkIcon size={16} />}
                        {overlayLoading ? "Eşleştiriliyor..." : "Eşleşme Yap"}
                    </button>
                    <button onClick={handleExportExcel} disabled={!rows.length} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border hover:bg-gray-50 disabled:opacity-50">
                        <FileSpreadsheet size={16} /> Dışarı Aktar
                    </button>
                </div>
            </div>

            {/* SÜRÜKLE-BIRAK ALANI */}
            <div className="rounded-xl border overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2 border-b text-xs text-gray-700">
                    <ListChecks size={16} /> <span className="font-medium">Şablon</span>
                    <span className="text-[11px] text-gray-500">
                        (Legacy: B→Alıcı, C→Teslim, F→Müşteri Sipariş No. Sabitler: VKN 079002095, Proje 458, Yükleme Firması 13, Ürün 2, Kap 1, Ambalaj 1. Tarihler: bugün/+1)
                    </span>
                </div>

                <div
                    className={`relative ${rows.length === 0 ? "min-h-[180px]" : ""}`}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDragEnd={onDragLeave}
                    onDragExit={onDragLeave}
                >
                    {rows.length === 0 && (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            aria-label="Excel sürükleyip bırak veya tıklayıp seç"
                            className={`flex flex-col items-center justify-center text-center p-6 cursor-pointer ${dragActive ? "bg-blue-50" : "bg-gray-50"}`}
                        >
                            <UploadCloud size={24} />
                            <div className="mt-1 font-medium text-sm">Excel’i buraya sürükleyip bırakın</div>
                            <div className="text-xs text-gray-500">ya da <b>tıklayın</b> (.xlsx / .xls)</div>
                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.xlsm" onChange={onFileChange} hidden />
                        </div>
                    )}

                    {rows.length > 0 && (
                        <div className="overflow-auto max-h-[70vh]">
                            <table className="min-w-full text-xs leading-tight text-gray-800 dark:text-gray-100">
                                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 text-gray-900 dark:text-gray-100">
                                    <tr>
                                        <th className="px-1.5 py-1 text-left w-10">#</th>
                                        {columns.map((c) => (
                                            <th key={c} className="px-1.5 py-1 text-left whitespace-nowrap">{c}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, rowIdx) => (
                                        <tr key={rowIdx} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800">
                                            <td className="px-1.5 py-1 align-top text-gray-500">{rowIdx + 1}</td>
                                            {columns.map((col) => (
                                                <td key={`${rowIdx}-${col}`} className="px-1.5 py-1 align-top">
                                                    <div className="max-w-[220px] truncate" title={row[col]}>{row[col]}</div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="px-3 py-2 text-[11px] text-gray-500 border-t">
                    İpucu: Excel’i yükledikten sonra “Eşleşme Yap” ile adresleri eşleştirebilirsiniz.
                </div>

                {error && (
                    <div className="mx-3 mb-3 mt-2 rounded-lg bg-rose-50 text-rose-700 px-2.5 py-2 flex items-start gap-2">
                        <X size={14} className="mt-0.5" />
                        <div className="text-xs">{error}</div>
                    </div>
                )}
                {lastFile && (
                    <p className="mx-3 mb-3 text-xs text-gray-600">
                        Yüklü: <b>{lastFile.name}</b>
                    </p>
                )}

                <div className="px-3 py-2 flex justify-end">
                    <button onClick={handleTemizle} disabled={!rows.length && !lastFile && !error} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50" title="Tabloyu ve uyarıları temizle">
                        Temizle
                    </button>
                </div>
            </div>

            {/* Eşleşme onay modali */}
            {matchModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-5xl rounded-2xl shadow-2xl bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                        {/* HEADER */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Adres Eşleşme Özeti</h3>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">Toplam: <b>{matchPreview.total}</b></span>
                                <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">Eşleşen: <b>{matchPreview.matchedCount}</b></span>
                                <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700">Eşleşmeyen: <b>{matchPreview.unmatchedCount}</b></span>
                            </div>
                        </div>

                        {/* BODY */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 max-h-[65vh] overflow-auto text-sm">
                            {/* EŞLEŞENLER */}
                            <div className="border rounded-xl border-gray-200 dark:border-gray-800">
                                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                                    <span className="font-medium">Eşleşenler</span>
                                    <span className="text-xs bg-gray-100 dark:bg-gray-800 rounded-full px-2">{matchPreview.matchedCount}</span>
                                </div>
                                {matchPreview.matchedSamples?.length ? (
                                    <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                                        {matchPreview.matchedSamples.map((s) => (
                                            <li key={`m-${s.rowIndex}`} className="p-3 space-y-1">
                                                <div className="text-xs text-gray-600 dark:text-gray-400">Bizim Adres</div>
                                                <div className="font-medium">{s.before}</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">Sistemdeki Adres</div>
                                                <div className="font-medium">{s.matchedAdresAdi}</div>
                                                <div className="text-[11px] mt-2 flex gap-2 text-gray-600 dark:text-gray-400">
                                                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">adres_id: {s.matchedAdresId}</span>
                                                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">cari_hesap_id: {s.matchedCariId}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-4 text-gray-600 dark:text-gray-400">Eşleşen kayıt yok.</div>
                                )}
                            </div>

                            {/* EŞLEŞMEYENLER */}
                            <div className="border rounded-xl border-gray-200 dark:border-gray-800">
                                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                                    <span className="font-medium">Eşleşmeyenler</span>
                                    <span className="text-xs bg-rose-100 text-rose-700 rounded-full px-2">{matchPreview.unmatchedCount}</span>
                                </div>
                                {matchPreview.unmatchedSamples?.length ? (
                                    <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                                        {matchPreview.unmatchedSamples.map((s) => (
                                            <li key={`u-${s.rowIndex}`} className="p-3 space-y-1">
                                                <div className="text-xs text-gray-600 dark:text-gray-400">Bizim Adres</div>
                                                <div className="font-medium">{s.before}</div>

                                                {/* Öneriler */}
                                                {s.suggestions?.length ? (
                                                    <div className="mt-2">
                                                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Öneriler</div>
                                                        <ul className="list-disc pl-5 space-y-0.5">
                                                            {s.suggestions.map((sg) => (
                                                                <li key={sg.adres_id}>
                                                                    <span className="font-medium">{sg.adres_adi}</span>{" "}
                                                                    <span className="text-xs text-gray-600 dark:text-gray-400">(skor: {sg.score})</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-600 dark:text-gray-400">Uygun öneri yok</div>
                                                )}

                                                {/* Manuel eşleştirme butonu */}
                                                <div className="pt-2">
                                                    <button
                                                        className="px-2 py-1 text-xs rounded-md border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                                                        onClick={() => openSelector(s.rowIndex, s.before)}
                                                    >
                                                        Eşleştir
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-4">Hepsi eşleşti 🎉</div>
                                )}
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2">
                            <button className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => setMatchModalOpen(false)}>
                                Vazgeç
                            </button>
                            <button className="px-2.5 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={confirmApplyMatches}>
                                Onayla ve Uygula
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manuel Eşleştirme / Adres Arama Modali */}
            {selOpen && (
                <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl rounded-2xl shadow-2xl bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                        {/* HEADER */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <div className="font-semibold">
                                Adres seç — Satır #{(selRowIndex ?? 0) + 1}
                            </div>
                            <button
                                className="text-sm px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700"
                                onClick={() => setSelOpen(false)}
                            >
                                Kapat
                            </button>
                        </div>

                        {/* SEARCH BAR — iki ayrı filtre */}
                        <div className="p-4 pt-3 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                    className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                    placeholder="Adres adı filtrele..."
                                    value={adresFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setAdresFilter(v);
                                        queueSelSearch(v, cariFilter);
                                    }}                                />
                                <input
                                    className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                    placeholder="Cari filtrele..."
                                    value={cariFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setCariFilter(v);
                                        queueSelSearch(adresFilter, v);
                                    }}                                />
                                <div className="flex gap-2">
                                    <button
                                        className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2"
                                        onClick={() => runAddressSearch(adresFilter, cariFilter)}
                                    >
                                        {selLoading ? <Loader2 size={16} className="animate-spin" /> : "Ara"}
                                    </button>
                                    <button
                                        className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        onClick={() => { setAdresFilter(""); setCariFilter(""); runAddressSearch("", ""); }}
                                    >
                                        Temizle
                                    </button>
                                </div>
                            </div>

                            {/* RESULTS TABLE — sadece adres_adi & cari */}
                            <div className="max-h-[55vh] overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                                        <tr className="text-left">
                                            <th className="px-2 py-2">adres_adi</th>
                                            <th className="px-2 py-2">cari</th>
                                            <th className="px-2 py-2 w-24"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selResults.map((it) => (
                                            <tr
                                                key={it.adres_id}
                                                className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800"
                                            >
                                                <td className="px-2 py-2">{it.adres_adi}</td>
                                                <td className="px-2 py-2">{it.cari || "—"}</td>
                                                <td className="px-2 py-2">
                                                    <button
                                                        className="px-2.5 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
                                                        onClick={() => applySelection(it)}
                                                    >
                                                        Seç
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}

                                        {selLoading && (
                                            <tr>
                                                <td
                                                    colSpan={3}
                                                    className="px-2 py-6 text-center text-gray-600 dark:text-gray-400"
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <Loader2 size={16} className="animate-spin" />
                                                        Yükleniyor...
                                                    </span>
                                                </td>
                                            </tr>
                                        )}

                                        {!selLoading && selResults.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={3}
                                                    className="px-2 py-6 text-center text-gray-600 dark:text-gray-400"
                                                >
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
