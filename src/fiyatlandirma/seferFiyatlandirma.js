import React, { useEffect, useMemo, useRef, useState } from "react";
import "./seferFiyatlandirma.css";
import ExcelJS from "exceljs";


const API_BASE = (process.env.REACT_APP_API_BASE_URL || "http://localhost:5000")
    .trim()
    .replace(/\/+$/, "");
const ODAK_KEY = (process.env.REACT_APP_ODAK_API_KEY || "").trim();

// Supabase
const SB_URL = (process.env.REACT_APP_SUPABASE_URL || "").trim();
const SB_KEY = (process.env.REACT_APP_SUPABASE_KEY || "").trim();
const HAS_SB = Boolean(SB_URL && SB_KEY);

/*Sabitler*/
const PROJECT_NAME = "BUNGE LÜLEBURGAZ FTL";
const COLUMN_DEFS = [
    { id: "TMSOrderId", label: "TMSOrderID", width: 7 },
    { id: "ProjectName", label: "PROJE", width: 12 },
    { id: "TMSDespatchDocumentNo", label: "SEFER NO", width: 10 },
    { id: "VehicleTypeName", label: "ARAÇ TİPİ", width: 10 },
    { id: "VehicleWorkingName", label: "ÇALIŞMA TİPİ", width: 7 },
    { id: "PickupAddressCode", label: "YÜKLEME NOKTASI", width: 11 },
    { id: "PickupCityName", label: "YÜKLEME İL", width: 6 },
    { id: "PickupCountyName", label: "YÜKLEME İLÇE", width: 6 },
    { id: "DeliveryAddressCode", label: "TESLİM NOKTASI", width: 11 },
    { id: "DeliveryCityName", label: "TESLİM İL", width: 6 },
    { id: "DeliveryCountyName", label: "TESLİM İLÇE", width: 6 },
    { id: "TMSVehicleRequestDocumentNo", label: "POZİSYON NO", width: 7 },
    { id: "SeferFiyati", label: "SEFER FİYATI", width: 8, isNumber: true },
    { id: "UgramaFiyati", label: "UĞRAMA FİYATI", width: 8, isNumber: true },
    { id: "OrderDate", label: "SİPARİŞ TARİHİ", width: 8, isDate: true },
    { id: "PickupDate", label: "YÜKLEME TARİHİ", width: 8, isDate: true },
];

const DF_FILTER = { value: "", from: "", to: "" };

/*Helpers */
const fmtDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date)) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
};

const toLocalISOString = (date, endOfDay = false) => {
    const pad = (n) => String(n).padStart(2, "0");
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = endOfDay ? "23" : "00";
    const min = endOfDay ? "59" : "00";
    const s = endOfDay ? "59" : "00";
    return `${y}-${m}-${d}T${h}:${min}:${s}`;
};


const stripDiacritics = (s = "") =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const cleanWS = (s = "") => String(s).trim().replace(/\s+/g, " ");
const foldTR = (s = "") => stripDiacritics(cleanWS(s).toLocaleLowerCase("tr"));
const norm = (s = "") => foldTR(s);
const equalsTR = (a, b) => foldTR(a) === foldTR(b);
const includesTR = (haystack, needle) =>
    foldTR(haystack).includes(foldTR(needle));
const ncity = (s = "") => {
    let t = norm(s);
    t = t.replace(/istanbul.*anadolu.*/i, "istanbul");
    t = t.replace(/istanbul.*avrupa.*/i, "istanbul");
    return t;
};
const ncounty = (s = "") => {
    let t = norm(s);
    t = t.replace(/\bmerkez(ilce)?\b/g, "merkez");
    t = t.replace(/\b(ilce|ilcesi)\b/g, "");
    return cleanWS(t);
};

const isKirkayak = (s = "") => foldTR(cleanWS(s)).includes("kirkayak");
const isOnTeker = (s = "") =>
    foldTR(cleanWS(s)).replace(/\s+/g, "").includes("onteker");
const isOpenCekiciRow = (rowOrText) => {
    const txt =
        typeof rowOrText === "object"
            ? `${rowOrText?.VehicleTypeName || ""} ${rowOrText?.VehicleWorkingName || ""}`
            : String(rowOrText || "");
    const up = cleanWS(txt).replace(/\u00A0/g, " ").toLocaleUpperCase("tr");
    const rawHit =
        up.includes("ÇEKİCİ") && up.includes("AÇIK") && !up.includes("KAPALI");
    if (rawHit) return true;
    let n = stripDiacritics(cleanWS(txt)).toLowerCase();
    n = n
        .replace(/\u00A0/g, " ")
        .replace(/[^a-z\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return n.includes("cekici") && n.includes("acik") && !n.includes("kapali");
};

const getMesafeVal = (item) => {
    const cand = [
        item?.Mesafe,
        item?.MESAFE,
        item?.mesafe,
        item?.Distance,
        item?.distance,
        item?.DistanceKm,
        item?.distanceKm,
        item?.MesafeKm,
        item?.MesafeKM,
        item?.TotalDistanceKm,
    ];
    const raw = cand.find(
        (v) => v !== undefined && v !== null && String(v).trim() !== ""
    );
    if (raw == null) return "";
    return String(raw).trim();
};

const parseListFlexible = (text) => {
    let json = null;
    try {
        json = JSON.parse(text);
    } catch { }
    if (Array.isArray(json)) return json;
    const candidates = [
        json?.data,
        json?.Data,
        json?.result,
        json?.items,
        json?.list,
    ];
    for (const c of candidates) if (Array.isArray(c)) return c;
    if (Array.isArray(json?.data?.items)) return json.data.items;
    if (Array.isArray(json?.Data?.Items)) return json.Data.Items;
    if (Array.isArray(json?.Results)) return json.Results;
    return [];
};

async function multiRequest(params) {
    const BASES = [API_BASE, `${API_BASE}/reel-api`];
    const PATHS = [
        { path: "/odak", methods: ["POST"] },
        { path: "/api/TmsOrders/GetAll", methods: ["POST", "GET"] },
        { path: "/api/tmsorders/getall", methods: ["POST", "GET"] },
        { path: "/TmsOrders/GetAll", methods: ["POST", "GET"] },
        { path: "/tmsorders/getall", methods: ["POST", "GET"] },
    ];
    const headersCommon = {
        Accept: "application/json",
        ...(ODAK_KEY ? { Authorization: ODAK_KEY } : {}),
    };

    const tried = [];
    for (const base of BASES) {
        for (const { path, methods } of PATHS) {
            for (const method of methods) {
                const urlBase = `${base}${path}`;
                const opts = { method, headers: { ...headersCommon } };
                let url = urlBase;

                if (method === "GET") {
                    url += `?${new URLSearchParams(params).toString()}`;
                } else {
                    opts.headers["Content-Type"] = "application/json";
                    opts.body = JSON.stringify(params);
                }

                tried.push(`${method} ${url}`);
                try {
                    const res = await fetch(url, opts);
                    const text = await res.text();
                    if (!res.ok) {
                        if (res.status !== 404)
                            throw new Error(
                                `HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`
                            );
                        continue;
                    }
                    const list = parseListFlexible(text);
                    return { list, connected: `${method} ${url}` };
                } catch {
                }
            }
        }
    }
    throw new Error("Tüm kombinasyonlar 404 döndü.\nDenemeler:\n" + tried.join("\n"));
}


const SB_TABLE = "bungeFiyatlar";
const SB_COLS = "teslim_il,teslim_ilce,mesafe,tir,kamyon";

async function fetchPriceMap(uniqueCities) {
    if (!HAS_SB) throw new Error("Supabase ortam değişkenleri tanımlı değil.");
    const inCities = `in.(${uniqueCities
        .map((v) => encodeURIComponent(String(v ?? "")))
        .join(",")})`;
    const url = `${SB_URL}/rest/v1/${SB_TABLE}?select=${encodeURIComponent(
        SB_COLS
    )}&teslim_il=${inCities}`;

    const res = await fetch(url, {
        headers: {
            apikey: SB_KEY,
            Authorization: `Bearer ${SB_KEY}`,
            Accept: "application/json",
            Prefer: "count=estimated",
        },
    });
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Supabase ${res.status}: ${t.slice(0, 200)}`);
    }

    const rows = await res.json();
    const map = new Map();
    const setVal = (key, r) => {
        const existing = map.get(key) || {};
        const mesafeNum = parseTRNumber(r.mesafe); 
        map.set(key, {
            tir: r.tir ?? existing.tir,
            kamyon: r.kamyon ?? existing.kamyon,
            mesafe: Number.isFinite(mesafeNum) ? mesafeNum : existing.mesafe ?? null,
        });
    };
    for (const r of rows) {
        const il = ncity(r.teslim_il);
        const ilce = r.teslim_ilce ? ncounty(r.teslim_ilce) : "";
        setVal(`${il}||*`, r);
        if (ilce) setVal(`${il}||${ilce}`, r);
    }
    return map;
}

// parçalama yardımcıları
const splitMulti = (s = "") =>
    String(s)
        .split(";")
        .map((t) => cleanWS(t))
        .filter(Boolean);


const parseTRNumber = (t) => {
    let s = String(t ?? "").toLowerCase().trim();
    s = s.replace(/[^0-9.,-]/g, "");
    if (!s) return NaN;

    const hasDot = s.includes(".");
    const hasComma = s.includes(",");

    if (hasDot && hasComma) {
        s = s.replace(/\./g, "").replace(",", ".");
    } else if (hasComma) {
        s = s.replace(",", ".");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
};


const splitMesafeToNums = (s = "") =>
    String(s)
        .split(";")
        .map((t) => parseTRNumber(t));

/*Component*/
export default function SeferFiyatlandirma() {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const [dates, setDates] = useState({
        start: yesterday.toISOString().slice(0, 10),
        end: today.toISOString().slice(0, 10),
    });
    const [applyProjectFilter, setApplyProjectFilter] = useState(true);
    const [rows, setRows] = useState([]);
    const [rawCount, setRawCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [calcLoading, setCalcLoading] = useState(false);
    const [error, setError] = useState("");
    const [connectedInfo, setConnectedInfo] = useState("");

    const buildVisibleInit = () =>
        Object.fromEntries(COLUMN_DEFS.map((c) => [c.id, true]));
    const DF = { ...DF_FILTER };
    const buildFiltersInit = () =>
        Object.fromEntries(COLUMN_DEFS.map((c) => [c.id, { ...DF }]));

    const [visibleCols, setVisibleCols] = useState(buildVisibleInit);
    const [colFilters, setColFilters] = useState(buildFiltersInit);
    const [sortBy, setSortBy] = useState({ id: "TMSOrderId", dir: "asc" });
    const [globalSearch, setGlobalSearch] = useState("");
    const [colWidths, setColWidths] = useState(() =>
        Object.fromEntries(COLUMN_DEFS.map((c) => [c.id, c.width || 8]))
    );
    const tableWrapRef = useRef(null);
    const resizingRef = useRef(null);

    const startResize = (e, colId) => {
        e.preventDefault();
        e.stopPropagation();
        const wrap = tableWrapRef.current;
        if (!wrap) return;
        const tableW =
            wrap.querySelector("table")?.getBoundingClientRect().width ||
            wrap.getBoundingClientRect().width ||
            1000;
        resizingRef.current = {
            id: colId,
            startX: e.clientX,
            startPct: colWidths[colId] ?? 8,
            tableW,
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", stopResize);
    };
    const handleMouseMove = (e) => {
        const r = resizingRef.current;
        if (!r) return;
        const deltaPx = e.clientX - r.startX;
        const deltaPct = (deltaPx / r.tableW) * 100;
        const next = Math.max(4, Math.min(40, r.startPct + deltaPct));
        setColWidths((prev) => ({ ...prev, [r.id]: next }));
    };
    const stopResize = () => {
        resizingRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", stopResize);
    };

    useEffect(() => {
        setVisibleCols((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const c of COLUMN_DEFS) {
                if (!(c.id in next)) {
                    next[c.id] = true;
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
        setColFilters((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const c of COLUMN_DEFS) {
                if (!next[c.id]) {
                    next[c.id] = { ...DF_FILTER };
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, []);

    const dateValid = useMemo(() => {
        if (!dates.start || !dates.end) return false;
        const s = new Date(dates.start);
        const e = new Date(dates.end);
        return !Number.isNaN(+s) && !Number.isNaN(+e) && s <= e;
    }, [dates.start, dates.end]);

    const handleFetch = async () => {
        if (!dateValid) return;
        setLoading(true);
        setError("");
        setRows([]);
        setRawCount(0);
        setConnectedInfo("");

        try {
            if (!API_BASE || !ODAK_KEY)
                throw new Error("REACT_APP_API_BASE_URL / REACT_APP_ODAK_API_KEY eksik.");

            const startLocal = toLocalISOString(new Date(dates.start), false);
            const endLocal = toLocalISOString(new Date(dates.end), true);

            let res1 = await multiRequest({
                startDate: startLocal,
                endDate: endLocal,
                userId: 1,
            });
            let list = res1.list;
            let connected = res1.connected;

            if (!list.length) {
                const startUTC = new Date(dates.start).toISOString();
                const endUTCDate = new Date(dates.end);
                endUTCDate.setHours(23, 59, 59, 999);
                const endUTC = endUTCDate.toISOString();
                const res2 = await multiRequest({
                    startDate: startUTC,
                    endDate: endUTC,
                    userId: 1,
                });
                list = res2.list;
                connected = res2.connected;
            }

            if (!list.length) {
                const res3 = await multiRequest({
                    startDate: dates.start,
                    endDate: dates.end,
                    userId: 1,
                });
                list = res3.list;
                connected = res3.connected;
            }

            setConnectedInfo(connected || "");
            setRawCount(Array.isArray(list) ? list.length : 0);

            let filtered = Array.isArray(list) ? list : [];
            if (applyProjectFilter) {
                filtered = filtered.filter((x) =>
                    equalsTR(x?.ProjectName, PROJECT_NAME)
                );
            }

            filtered = filtered.filter((x) => {
                const s = cleanWS(x?.TMSDespatchDocumentNo || "");
                if (!s) return false;
                const u = s.toUpperCase();
                if (u === "BOS") return false;
                return u.includes("SFR");
            });

            const GROUP_FIELDS = [
                "PickupAddressCode",
                "PickupCityName",
                "PickupCountyName",
                "DeliveryAddressCode",
                "DeliveryCityName",
                "DeliveryCountyName",
            ];
            const grouped = new Map();
            for (const item of filtered) {
                const key = item?.TMSVehicleRequestDocumentNo || "__no_pos__";
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key).push(item);
            }

            const mapped = [];
            for (const [pozisyonNo, items] of grouped.entries()) {
                if (!items.length) continue;
                const base = items[0];

                const accArr = {
                    PickupAddressCode: [],
                    PickupCityName: [],
                    PickupCountyName: [],
                    DeliveryAddressCode: [],
                    DeliveryCityName: [],
                    DeliveryCountyName: [],
                    Mesafe: [],
                };
                for (const it of items) {
                    for (const f of GROUP_FIELDS) accArr[f].push(cleanWS(it?.[f] ?? ""));
                    accArr.Mesafe.push(cleanWS(getMesafeVal(it)));
                }
                const acc = Object.fromEntries(
                    Object.entries(accArr).map(([k, arr]) => [k, arr.join("; ")])
                );
                const __segments = items.map((it) => ({
                    il: cleanWS(it?.DeliveryCityName ?? ""),
                    ilce: cleanWS(it?.DeliveryCountyName ?? ""),
                    mesafe: parseTRNumber(getMesafeVal(it) ?? "")
                }));

                mapped.push({
                    TMSOrderId: base?.TMSOrderId ?? pozisyonNo,
                    ProjectName: base?.ProjectName ?? "",
                    TMSDespatchDocumentNo: base?.TMSDespatchDocumentNo ?? "",
                    VehicleTypeName: base?.VehicleTypeName ?? "",
                    VehicleWorkingName: base?.VehicleWorkingName ?? "",
                    ...acc,
                    TMSVehicleRequestDocumentNo: pozisyonNo,
                    OrderDate: fmtDate(base?.OrderDate),
                    PickupDate: fmtDate(base?.PickupDate),
                    SeferFiyati: 0,
                    UgramaFiyati: 0,
                    __segments,                   
                });
            }

            setRows(mapped);
        } catch (err) {
            console.error(err);
            setError(err?.message || "Veri çekilemedi.");
        } finally {
            setLoading(false);
        }
    };


    const handleCalculate = async () => {
        if (!rows.length) return;
        if (!HAS_SB) {
            alert(
                "Hesaplama için Supabase ayarları yok.\n.env içine REACT_APP_SUPABASE_URL + REACT_APP_SUPABASE_KEY girin."
            );
            return;
        }
        setCalcLoading(true);
        try {
            const citiesRaw = rows
                .flatMap((r) => splitMulti(r.DeliveryCityName))
                .filter(Boolean);
            const cities = Array.from(new Map(citiesRaw.map((c) => [cleanWS(c), c])).keys());
            if (!cities.length) {
                setCalcLoading(false);
                return;
            }


            const priceMap = await fetchPriceMap(cities);

            setRows((prev) =>
                prev.map((r) => {
                    let sefer = Number(r.SeferFiyati || 0);
                    const getValByVehicle = (priceObj) => {
                        if (!priceObj) return null;
                        if (isOnTeker(r.VehicleTypeName)) return priceObj.kamyon ?? priceObj.tir ?? null;
                        if (isOpenCekiciRow(r)) return priceObj.tir ?? priceObj.kamyon ?? null;
                        if (isKirkayak(r.VehicleTypeName)) return priceObj.tir ?? priceObj.kamyon ?? null;
                        return priceObj.tir ?? priceObj.kamyon ?? null;
                    };

                    let segments;
                    if (Array.isArray(r.__segments) && r.__segments.length) {
                        segments = r.__segments.map((s) => {
                            const ilRaw = s.il ?? "";
                            const ilceRaw = s.ilce ?? "";
                            const key = `${ncity(ilRaw)}||${ncounty(ilceRaw)}`;
                            const sb = priceMap.get(key);
                            const sbMesafe = Number.isFinite(sb?.mesafe) ? sb.mesafe : -Infinity;
                            const fallback = Number.isFinite(s.mesafe) ? s.mesafe : -Infinity;
                            return { il: ilRaw, ilce: ilceRaw, sbMesafe, fallback };
                        });
                    } else {
                        // Fallback: birleştirilmiş stringlerden üret
                        const cityList = splitMulti(r.DeliveryCityName);
                        const countyList = splitMulti(r.DeliveryCountyName);
                        const rowMesafeNums = splitMesafeToNums(r.Mesafe || "");
                        const len = Math.max(cityList.length, countyList.length, rowMesafeNums.length);
                        segments = Array.from({ length: len }, (_, i) => {
                            const ilRaw = cityList[i] ?? cityList[0] ?? "";
                            const ilceRaw = countyList[i] ?? countyList[0] ?? "";
                            const key = `${ncity(ilRaw)}||${ncounty(ilceRaw)}`;
                            const sb = priceMap.get(key);
                            const sbMesafe = Number.isFinite(sb?.mesafe) ? sb.mesafe : -Infinity;
                            const fallback = Number.isFinite(rowMesafeNums[i]) ? rowMesafeNums[i] : -Infinity;
                            return { il: ilRaw, ilce: ilceRaw, sbMesafe, fallback };
                        });
                    }

                    // Eğer hiçbir segmentte Supabase mesafesi yoksa, fallback mesafeleri kullan
                    const allNegInf = segments.every((s) => s.sbMesafe === -Infinity);
                    if (allNegInf) {
                        segments = segments.map((s) => ({ ...s, sbMesafe: s.fallback }));
                    }

                    // En yüksek mesafe önce
                    segments.sort((a, b) => b.sbMesafe - a.sbMesafe);

                    // Aynı (il, ilçe) tekilleştir
                    const seen = new Set();
                    const uniqSegments = [];
                    for (const seg of segments) {
                        const key = `${foldTR(seg.il)}|${foldTR(seg.ilce)}`;
                        if (seen.has(key)) continue;
                        seen.add(key);
                        uniqSegments.push(seg);
                    }

                    let chosen = null;
                    for (const { il: rawIl, ilce: rawIlce } of uniqSegments) {
                        const il = ncity(rawIl);
                        const ilce = ncounty(rawIlce);
                        const obj = priceMap.get(`${il}||${ilce}`);
                        const v = getValByVehicle(obj);
                        if (v != null) { chosen = v; break; }
                    }
                    if (chosen == null) {
                        for (const { il: rawIl } of uniqSegments) {
                            const il = ncity(rawIl);
                            const obj = priceMap.get(`${il}||*`);
                            const v = getValByVehicle(obj);
                            if (v != null) { chosen = v; break; }
                        }
                    }
                    if (chosen != null) {
                        const parsed = Number(String(chosen).replace(",", "."));
                        if (!Number.isNaN(parsed)) sefer = Math.round(parsed * 100) / 100;
                    }


                    const deliveryCity = String(r.DeliveryCityName || "");
                    const semiCount = (deliveryCity.match(/;/g) || []).length; 

                    let ugrama = 0; 
                    if (semiCount > 0) {
                        let base = null;
                        const vtRaw = r.VehicleTypeName || "";
                        if (isOpenCekiciRow(r)) base = 1553;
                        else if (isOnTeker(vtRaw)) base = 1035;
                        else if (isKirkayak(vtRaw)) base = 1294;

                        if (base != null) {
                            ugrama = Math.round(base * semiCount * 100) / 100; 
                        }
                    }
                    return { ...r, SeferFiyati: sefer, UgramaFiyati: ugrama };
                })
            );
        } catch (e) {
            console.error(e);
            alert("Hesaplama sırasında hata: " + e.message);
        } finally {
            setCalcLoading(false);
        }
    };
    /*Filtreleme + Arama + Sıralama*/
    const filteredAndSorted = useMemo(() => {
        let data = rows;

        if (globalSearch.trim()) {
            const q = globalSearch;
            data = data.filter((r) =>
                Object.values(r).some((v) => includesTR(v ?? "", q))
            );
        }

        data = data.filter((r) =>
            COLUMN_DEFS.every((col) => {
                const f = colFilters[col.id] || DF_FILTER;
                const val = (r[col.id] ?? "").toString();

                if (col.isDate) {
                    const toKey = (s) => {
                        if (!s) return "";
                        const [dd, mm, yyyy] = s.split(".");
                        if (!yyyy || !mm || !dd) return "";
                        return `${yyyy}${mm}${dd}`;
                    };
                    const currKey = toKey(val),
                        fromKey = toKey(f.from),
                        toKeyV = toKey(f.to);
                    if (f.from && currKey && currKey < fromKey) return false;
                    if (f.to && currKey && currKey > toKeyV) return false;
                    return true;
                }

                if (col.isNumber) {
                    const n = Number(val);
                    const hasMin = f.from !== "" && !Number.isNaN(Number(f.from));
                    const hasMax = f.to !== "" && !Number.isNaN(Number(f.to));
                    if (hasMin && !(n >= Number(f.from))) return false;
                    if (hasMax && !(n <= Number(f.to))) return false;
                    return true;
                }

                if (f.value && !includesTR(val, f.value)) return false;
                return true;
            })
        );

        if (sortBy?.id) {
            const dir = sortBy.dir === "desc" ? -1 : 1;
            data = [...data].sort((a, b) => {
                const va = a[sortBy.id] ?? "";
                const vb = b[sortBy.id] ?? "";
                const col = COLUMN_DEFS.find((c) => c.id === sortBy.id);
                if (col?.isNumber) {
                    const na = Number(va) || 0,
                        nb = Number(vb) || 0;
                    return (na - nb) * dir;
                }
                if (!isNaN(+va) && !isNaN(+vb)) return (Number(va) - Number(vb)) * dir;
                return va.toString().localeCompare(vb.toString(), "tr") * dir;
            });
        }

        return data;
    }, [rows, globalSearch, colFilters, sortBy]);

    const toggleSort = (colId) => {
        setSortBy((prev) => {
            if (prev.id !== colId) return { id: colId, dir: "asc" };
            if (prev.dir === "asc") return { id: colId, dir: "desc" };
            return { id: "", dir: "asc" };
        });
    };

    /*EXCEL'E AKTAR*/
    const handleExportExcel = async () => {
        const visibleColsOrder = COLUMN_DEFS.filter((c) => visibleCols[c.id]);
        if (!filteredAndSorted.length || visibleColsOrder.length === 0) return;

        const colors = {
            headerFill: "FF16323E",
            headerFont: "FFFFFFFF",
            gridBorder: "FF7CE6D3",
            bandFill: "FFF3FBF8",
            baseFill: "FFFFFFFF",
            textDark: "FF000000",  
            money: "FF000000",    
            muted: "FF5AAEA0",
        };
        const wb = new ExcelJS.Workbook();
        wb.created = new Date();
        wb.modified = new Date();
        const ws = wb.addWorksheet("Sefer Fiyatlandırma", {
            views: [{ state: "frozen", ySplit: 2 }], 
        });

        const pxToChars = (pct) => Math.max(8, Math.round((pct / 100) * 120));
        ws.columns = visibleColsOrder.map((c) => ({
            header: c.label,
            key: c.id,
            width: pxToChars(colWidths[c.id] ?? c.width ?? 8),
            style: {
                alignment: { vertical: "middle", wrapText: true },
                font: { name: "Segoe UI", size: 11, color: { argb: colors.textDark } },
            },
        }));


        const headerRow = ws.getRow(1);
        headerRow.values = visibleColsOrder.map((c) => c.label);
        headerRow.font = { name: "Segoe UI Semibold", bold: true, color: { argb: colors.headerFont }, size: 12 };
        headerRow.alignment = { vertical: "middle" };
        headerRow.height = 24;
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: colors.headerFill },
            };
            cell.border = {
                top: { style: "thin", color: { argb: colors.gridBorder } },
                left: { style: "thin", color: { argb: colors.gridBorder } },
                bottom: { style: "thin", color: { argb: colors.gridBorder } },
                right: { style: "thin", color: { argb: colors.gridBorder } },
            };
        });


        const infoRow = ws.addRow([
            `Aralık: ${dates.start} → ${dates.end}`,
            `Filtre: ${applyProjectFilter ? PROJECT_NAME : "Tümü"}`,
            `Toplam: ${filteredAndSorted.length}`,
            ...Array(Math.max(0, visibleColsOrder.length - 3)).fill(""),
        ]);
        infoRow.font = { italic: true, color: { argb: colors.muted } };
        infoRow.alignment = { vertical: "middle" };
        infoRow.height = 18;


        const moneyCols = new Set(
            visibleColsOrder.filter((c) => c.id === "SeferFiyati" || c.id === "UgramaFiyati").map((c) => c.id)
        );
        const dateCols = new Set(
            visibleColsOrder.filter((c) => c.isDate).map((c) => c.id)
        );

        for (const r of filteredAndSorted) {
            const rowObj = {};
            for (const c of visibleColsOrder) {
                let v = r[c.id];
                if (moneyCols.has(c.id)) {
                    const num = Number(v || 0);
                    v = Number.isFinite(num) ? num : null;
                } else if (dateCols.has(c.id)) {
                    if (typeof v === "string" && /^\d{2}\.\d{2}\.\d{4}$/.test(v)) {
                        const [dd, mm, yyyy] = v.split(".");
                        v = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                    }
                }
                rowObj[c.id] = v;
            }
            ws.addRow(rowObj);
        }


        ws.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: visibleColsOrder.length },
        };


        const firstDataRow = 3; 
        for (let i = firstDataRow; i <= ws.rowCount; i++) {
            const row = ws.getRow(i);
            const isBand = i % 2 === 0;
            row.eachCell((cell, colNumber) => {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: isBand ? colors.bandFill : colors.baseFill },
                };


                cell.border = {
                    top: { style: "thin", color: { argb: colors.gridBorder } },
                    left: { style: "thin", color: { argb: colors.gridBorder } },
                    bottom: { style: "thin", color: { argb: colors.gridBorder } },
                    right: { style: "thin", color: { argb: colors.gridBorder } },
                };


                cell.font = { ...(cell.font || {}), color: { argb: colors.textDark } };

                const colKey = ws.getColumn(colNumber).key;

                if (moneyCols.has(colKey)) {
                    cell.numFmt = '[$₺-tr-TR] #,##0.00;[Red]-[$₺-tr-TR] #,##0.00';
                    cell.font = { ...(cell.font || {}), color: { argb: colors.money } };
                } else if (dateCols.has(colKey) && cell.value instanceof Date) {
                    cell.numFmt = "dd.mm.yyyy";
                } else {
                    cell.alignment = { vertical: "middle", wrapText: true };
                }
            });
            row.height = 18;
        }


        ws.columns.forEach((col) => {
            let max = col.width || 12;
            col.eachCell({ includeEmpty: false }, (cell) => {
                const val = cell.value;
                const len =
                    typeof val === "string"
                        ? val.length
                        : typeof val === "number"
                            ? String(val).length + 2
                            : val instanceof Date
                                ? 10
                                : 8;
                if (len + 2 > max) max = Math.min(len + 2, 45);
            });
            col.width = Math.max(col.width || 12, max);
        });
        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], {
            type:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tmsorders_${dates.start}_${dates.end}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };


    const tl = useMemo(
        () =>
            new Intl.NumberFormat("tr-TR", {
                style: "currency",
                currency: "TRY",
                maximumFractionDigits: 2,
            }),
        []
    );
    const renderCell = (colId, value) => {
        if (colId === "SeferFiyati" || colId === "UgramaFiyati") {
            const num = Number(value || 0);
            return num ? tl.format(num) : "";
        }
        return value ?? "";
    };

    return (
        <section className="fx-content">
            <style>{`
        .fx-content{display:flex;flex-direction:column;gap:14px;padding:18px;height:100dvh;overflow:hidden;background:
          radial-gradient(1000px 520px at 10% -10%, rgba(119,255,231,.08), transparent 60%),
          radial-gradient(800px 520px at 110% 0%, rgba(89,219,255,.06), transparent 65%),
          #0b0f14;}
        .fx-toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:22px;background:linear-gradient(180deg,rgba(18,22,28,.78),rgba(18,22,28,.6));border:1px solid rgba(119,255,231,.28);backdrop-filter:blur(14px)}
        .fx-title{font-weight:800;letter-spacing:.2px;color:#eafff7}
        .pill{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(119,255,231,.28)}
        .pill input{height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.18);color:inherit;padding:0 8px}
        .switch{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;border:1px dashed rgba(119,255,231,.4)}
        .fx-btn{--h:40px;display:inline-flex;align-items:center;gap:8px;height:var(--h);padding:0 14px;border-radius:12px;border:1px solid rgba(119,255,231,.4);background:linear-gradient(180deg,rgba(119,255,231,.18),rgba(0,160,160,.12));color:inherit;cursor:pointer}
        .fx-btn-outline{background:linear-gradient(180deg,rgba(89,219,255,.12),rgba(89,219,255,.06));border-color:rgba(89,219,255,.6)}
        .fx-btn-ghost{background:transparent;border-color:transparent;outline:1px dashed rgba(119,255,231,.45)}
        .fx-badge{font-size:12px;padding:6px 10px;border-radius:999px;background:linear-gradient(180deg,rgba(119,255,231,.18),rgba(119,255,231,.08));border:1px solid rgba(119,255,231,.4);color:#dffff7}
        .fx-card{background:linear-gradient(180deg,rgba(18,22,28,.6),rgba(18,22,28,.78));border:1px solid rgba(119,255,231,.28);border-radius:22px}
        .fx-input{border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);padding:10px 12px;color:inherit;width:100%}
        .fx-table-wrap{padding:10px;border-radius:22px;display:flex;flex-direction:column;min-height:0;background:linear-gradient(180deg,rgba(18,22,28,.6),rgba(18,22,28,.78));border:1px solid rgba(119,255,231,.28)}
        .fx-table-scroll{flex:1 1 auto;min-height:0;overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,.08);max-height:clamp(420px,60vh,780px)}
        .fx-table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}
        .fx-table thead th{position:sticky;top:0;z-index:1;background:linear-gradient(180deg,rgba(18,22,28,.9),rgba(0,0,0,.35));border-bottom:1px solid rgba(119,255,231,.28);padding:8px 10px;text-align:left;font-weight:800;color:#d7fff6}
        .th-inner{display:flex;align-items:center;justify-content:space-between;gap:6px;cursor:pointer}
        .th-filter{background:transparent;border-bottom:1px solid rgba(119,255,231,.16)}
        .th-filter-row{display:flex;align-items:center;gap:6px}
        .th-filter input[type="text"], .th-filter input[type="number"]{width:100%;padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:inherit}
        .fx-table tbody td{padding:7px 9px;border-bottom:1px solid rgba(255,255,255,.05);line-height:1.25}
        .fx-table tbody tr:nth-child(2n){background:rgba(255,255,255,.018)}
        .fx-table tbody tr:hover{background:rgba(119,255,231,.06)}
        .fx-table td:first-child,.fx-table th:first-child{position:sticky;left:0;z-index:2;background:linear-gradient(180deg,rgba(18,22,28,.9),rgba(0,0,0,.32))}
        .col-resizer{position:absolute;right:-4px;top:0;width:8px;height:100%;cursor:col-resize}
        .col-resizer::after{content:"";position:absolute;right:3px;top:25%;height:50%;width:2px;background:rgba(255,255,255,.14);border-radius:2px}
        .fx-empty{text-align:center;color:#9bd7c9;padding:26px}
      `}</style>

            {/* Toolbar */}
            <div className="fx-toolbar">
                <div
                    className="fx-toolbar__left"
                    style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
                >
                    <h1 className="fx-title m-0">Sefer Fiyatlandırma</h1>

                    <div className="pill">
                        <span>Aralık</span>
                        <input
                            type="date"
                            value={dates.start}
                            onChange={(e) => setDates((d) => ({ ...d, start: e.target.value }))}
                        />
                        <span className="pill__sep">→</span>
                        <input
                            type="date"
                            value={dates.end}
                            onChange={(e) => setDates((d) => ({ ...d, end: e.target.value }))}
                            min={dates.start || undefined}
                        />
                    </div>

                    <label
                        className="switch"
                        title={`Tabloyu yalnızca "${PROJECT_NAME}" ile sınırla`}
                    >
                        <input
                            type="checkbox"
                            checked={applyProjectFilter}
                            onChange={(e) => setApplyProjectFilter(e.target.checked)}
                        />
                        <span>{`Sadece "${PROJECT_NAME}"`}</span>
                    </label>
                </div>

                <div
                    className="fx-toolbar__right"
                    style={{ gap: 8, display: "flex", alignItems: "center", flexWrap: "wrap" }}
                >
                    <button
                        className="fx-btn fx-btn-outline"
                        onClick={handleFetch}
                        disabled={!dateValid || loading}
                        title="Veri Getir"
                    >
                        {loading ? "Yükleniyor…" : "Veri Getir"}
                    </button>

                    <button
                        className="fx-btn fx-btn-outline"
                        onClick={handleCalculate}
                        disabled={!rows.length || calcLoading || !HAS_SB}
                        title={HAS_SB ? "Supabase fiyatları uygula" : "Supabase ayarları yok (.env dosyasını doldurun)"}
                    >
                        {calcLoading ? "Hesaplanıyor…" : "HESAPLA"}
                    </button>

                    <button
                        className="fx-btn fx-btn-ghost"
                        onClick={() => {
                            setColFilters(buildFiltersInit());
                            setGlobalSearch("");
                        }}
                        title="Tüm filtreleri temizle"
                    >
                        Filtreleri Sıfırla
                    </button>

                    <button
                        className="fx-btn fx-btn-outline"
                        onClick={handleExportExcel}
                        disabled={!rows.length}
                        title="Excel (.xlsx) olarak dışa aktar"
                    >
                        Excel’e Aktar
                    </button>

                    {connectedInfo && (
                        <span className="fx-badge" title="Bağlanan uç nokta">
                            {connectedInfo}
                        </span>
                    )}
                    <span className="fx-badge">Ham: {rawCount}</span>
                    <span className="fx-badge">Tablo: {rows.length}</span>
                    <span className="fx-badge">Görünen: {filteredAndSorted.length}</span>
                </div>
            </div>

            {/* Hata banner */}
            {error && (
                <div
                    className="fx-card"
                    style={{
                        padding: 12,
                        color: "#ffb4b4",
                        marginBottom: 10,
                        whiteSpace: "pre-wrap",
                        borderColor: "rgba(255,100,100,.35)",
                        background: "rgba(120,10,10,.25)",
                    }}
                >
                    <b>Hata:</b> {error}
                </div>
            )}

            {/* Arama kutusu */}
            <div
                className="fx-card"
                style={{ padding: 8, marginBottom: 10, display: "flex", gap: 8 }}
            >
                <input
                    className="fx-input"
                    placeholder="Genel arama (Türkçe uyumlu)"
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    style={{ flex: 1 }}
                />
            </div>

            {/* Tablo */}
            <div className="fx-card fx-table-wrap" ref={tableWrapRef}>
                <div className="fx-table-scroll">
                    <table className="fx-table" role="table">
                        <thead>
                            <tr>
                                {COLUMN_DEFS.map((c) =>
                                    visibleCols[c.id] ? (
                                        <th
                                            key={c.id}
                                            className="_resizable"
                                            style={{
                                                width: `${colWidths[c.id] ?? c.width ?? 8}%`,
                                                minWidth: 40,
                                            }}
                                        >
                                            <div
                                                className="th-inner"
                                                onClick={() => toggleSort(c.id)}
                                                title="Sırala"
                                            >
                                                <span>{c.label}</span>
                                                {sortBy.id === c.id && (
                                                    <b>{sortBy.dir === "asc" ? " ▲" : " ▼"}</b>
                                                )}
                                            </div>

                                            <div className="th-filter">
                                                {c.isNumber ? (
                                                    <div className="th-filter-row">
                                                        <input
                                                            type="number"
                                                            placeholder="min"
                                                            value={(colFilters[c.id] || DF_FILTER).from}
                                                            onChange={(e) =>
                                                                setColFilters((f) => ({
                                                                    ...f,
                                                                    [c.id]: {
                                                                        ...(f[c.id] || { ...DF_FILTER }),
                                                                        from: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                        />
                                                        <span>–</span>
                                                        <input
                                                            type="number"
                                                            placeholder="max"
                                                            value={(colFilters[c.id] || DF_FILTER).to}
                                                            onChange={(e) =>
                                                                setColFilters((f) => ({
                                                                    ...f,
                                                                    [c.id]: {
                                                                        ...(f[c.id] || { ...DF_FILTER }),
                                                                        to: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                ) : c.isDate ? (
                                                    <div className="th-filter-row">
                                                        <input
                                                            type="text"
                                                            placeholder="gg.aa.yyyy min"
                                                            value={(colFilters[c.id] || DF_FILTER).from}
                                                            onChange={(e) =>
                                                                setColFilters((f) => ({
                                                                    ...f,
                                                                    [c.id]: {
                                                                        ...(f[c.id] || { ...DF_FILTER }),
                                                                        from: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                        />
                                                        <span>–</span>
                                                        <input
                                                            type="text"
                                                            placeholder="gg.aa.yyyy max"
                                                            value={(colFilters[c.id] || DF_FILTER).to}
                                                            onChange={(e) =>
                                                                setColFilters((f) => ({
                                                                    ...f,
                                                                    [c.id]: {
                                                                        ...(f[c.id] || { ...DF_FILTER }),
                                                                        to: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        placeholder="filtre"
                                                        value={(colFilters[c.id] || DF_FILTER).value}
                                                        onChange={(e) =>
                                                            setColFilters((f) => ({
                                                                ...f,
                                                                [c.id]: {
                                                                    ...(f[c.id] || { ...DF_FILTER }),
                                                                    value: e.target.value,
                                                                },
                                                            }))
                                                        }
                                                    />
                                                )}
                                            </div>

                                            <span
                                                className="col-resizer"
                                                onMouseDown={(e) => startResize(e, c.id)}
                                                title="Sütun genişliğini ayarla"
                                                aria-hidden
                                            />
                                        </th>
                                    ) : null
                                )}
                            </tr>
                        </thead>

                        <tbody>
                            {!loading && filteredAndSorted.length === 0 && (
                                <tr>
                                    <td colSpan={COLUMN_DEFS.length} className="fx-empty">
                                        Veri yok. Tarih aralığı seçip <b>Veri Getir</b>'e tıklayın.
                                    </td>
                                </tr>
                            )}

                            {loading && (
                                <tr>
                                    <td colSpan={COLUMN_DEFS.length} className="fx-empty">
                                        Yükleniyor...
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                filteredAndSorted.map((r, idx) => (
                                    <tr key={`${r.TMSOrderId}-${idx}`}>
                                        {COLUMN_DEFS.map((c) =>
                                            visibleCols[c.id] ? (
                                                <td
                                                    key={c.id}
                                                    style={{
                                                        width: `${colWidths[c.id] ?? c.width ?? 8}%`,
                                                    }}
                                                >
                                                    {renderCell(c.id, r[c.id])}
                                                </td>
                                            ) : null
                                        )}
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
