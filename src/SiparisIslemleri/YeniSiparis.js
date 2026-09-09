import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    AlertCircle,
    Building2,
    Check,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    FileUp,
    LoaderCircle,
    PackageOpen,
    Pencil,
    Plus,
    RefreshCw,
    Save,
    Search,
    Trash2,
    UploadCloud,
    Users,
    X,
} from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import supabase from "../supabaseClient";
import "./YeniSiparis.css";

const MAPPING_TABLE = "yeni_siparis_mapping";
const CUSTOMER_TABLE = "musteriler";
const LEGACY_CUSTOMER_TABLE = "Proje_Tanitim_Karti";

// Sipariş Oluştur ekranının kabul ettiği standart kolon sırası.
const TEMPLATE_HEADERS = [
    "Vkn",
    "Proje",
    "Sipariş Tarihi",
    "Yükleme Tarihi",
    "Teslim Tarihi",
    "Müşteri Sipariş No",
    "Müşteri Referans No",
    "İstenilen Araç Tipi",
    "Açıklama",
    "Yükleme Firması Adı",
    "Alıcı Firma Cari Adı",
    "Teslim Firma Adres Adı",
    "İrsaliye No",
    "İrsaliye Miktarı",
    "Ürün",
    "Kap Adet",
    "Ambalaj Tipi",
    "Brüt KG",
    "M3",
    "Desi",
];

const ORDER_INPUT_HEADERS = [
    "Müşteri Adı",
    "Sipariş Tarihi",
    "Müşteri Sipariş No",
    "İstenilen Araç Tipi",
    "Açıklama",
    "Yükleme Firması Adı",
    "Teslim FirmaAdres Adı",
];

const REQUIRED_IMPORT_HEADERS = [...ORDER_INPUT_HEADERS];

const VEHICLE_TYPE_OPTIONS = [
    { label: "TIR", code: "21", aliases: ["TIR", "Tır", "tır", "tir"] },
    { label: "ONTEKER", code: "3", aliases: ["ONTEKER", "Onteker", "onteker", "on teker", "ON TEKER"] },
    { label: "KIRKAYAK", code: "2", aliases: ["KIRKAYAK", "Kırkayak", "kırkayak", "kirkayak"] },
    { label: "H.KAMYON", code: "4", aliases: ["H.KAMYON", "H.Kamyon", "h.kamyon", "h kamyon", "H KAMYON"] },
];

const normalizeVehicleType = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const upper = text
        .toLocaleUpperCase("tr-TR")
        .replace(/\s+/g, " ")
        .trim();
    const match = VEHICLE_TYPE_OPTIONS.find((item) =>
        item.code === text ||
        item.aliases.some((alias) => alias.toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim() === upper)
    );
    return match?.code || text;
};

const vehicleLabelFromCode = (value) => VEHICLE_TYPE_OPTIONS.find((item) => item.code === String(value ?? ""))?.label || String(value ?? "");

const DATE_HEADERS = new Set(["Sipariş Tarihi", "Yükleme Tarihi", "Teslim Tarihi"]);

const EDITABLE_ORDER_HEADERS = new Set([
    "Sipariş Tarihi",
    "Müşteri Sipariş No",
    "İstenilen Araç Tipi",
    "Açıklama",
    "Yükleme Firması Adı",
    "Alıcı Firma Cari Adı",
    "Teslim Firma Adres Adı",
]);

const MAPPING_COLUMNS = [
    { key: "musteriden_gelen", label: "Müşteriden Gelen", required: true },
    { key: "teslim_alan_firma", label: "Teslim Alan Firma" },
    { key: "teslim_firmasi_id", label: "Teslim Firması ID" },
    { key: "teslim_noktasi_adi", label: "Teslim Noktası Adı", required: true },
    { key: "teslim_noktasi_id", label: "Teslim Noktası ID" },
    { key: "teslim_noktasi_il", label: "Teslim Noktası İl" },
    { key: "teslim_noktasi_ilce", label: "Teslim Noktası İlçe" },
];

const emptyMapping = () => ({
    musteriden_gelen: "",
    teslim_alan_firma: "",
    teslim_firmasi_id: "",
    teslim_noktasi_adi: "",
    teslim_noktasi_id: "",
    teslim_noktasi_il: "",
    teslim_noktasi_ilce: "",
});

const emptyCustomer = () => ({
    cari_firma_id: "",
    vkn: "",
    urun_id: "",
    proje_adi: "",
    proje_karti_id: "",
    firma_unvani: "",
    hizmet_tipi: "",
    alt_hizmet_tipi: "",
    erp_proje_kodu: "",
});

const CUSTOMER_IMPORT_ALIASES = {
    cari_firma_id: ["cari firma id", "cari firma", "cari id", "firma id"],
    vkn: ["vkn", "vergi no", "vergi numarası", "vergi numarasi"],
    urun_id: ["ürün id", "urun id", "ürün kodu", "urun kodu"],
    proje_adi: ["proje adı", "proje adi", "proje"],
    proje_karti_id: ["proje kartı id", "proje karti id", "proje id", "proje kartı", "proje karti"],
    firma_unvani: ["firma unvani", "firma ünvanı", "firma unvanı", "firma", "müşteri", "musteri", "müşteri adı"],
    hizmet_tipi: ["hizmet tipi", "hizmet türü", "hizmet turu"],
    alt_hizmet_tipi: ["alt hizmet tipi", "alt hizmet türü", "alt hizmet turu"],
    erp_proje_kodu: ["erp proje kodu", "erp proje", "erp kodu"],
};

const normalize = (value) =>
    String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();

const normalizeKey = (value) =>
    normalize(value)
        .toLocaleUpperCase("tr-TR")
        .replace(/[İI]/g, "I")
        .replace(/Ğ/g, "G")
        .replace(/Ü/g, "U")
        .replace(/Ş/g, "S")
        .replace(/Ö/g, "O")
        .replace(/Ç/g, "C")
        .replace(/[^A-Z0-9]/g, "");

const normalizeHeader = (value) =>
    normalize(value)
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]/g, "");

const FUZZY_STOP_WORDS = new Set([
    "ANONIM", "SIRKETI", "SIRKET", "LIMITED", "LTD", "SANAYI", "TICARET", "VE", "AS", "AŞ", "STI", "ŞTI",
]);

const tokenizeForMatch = (value) =>
    normalize(value)
        .toLocaleUpperCase("tr-TR")
        .replace(/[İI]/g, "I")
        .replace(/Ğ/g, "G")
        .replace(/Ü/g, "U")
        .replace(/Ş/g, "S")
        .replace(/Ö/g, "O")
        .replace(/Ç/g, "C")
        .replace(/[^A-Z0-9]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 1 && !FUZZY_STOP_WORDS.has(token));

const levenshteinDistance = (a, b) => {
    const left = String(a || "");
    const right = String(b || "");
    if (!left.length) return right.length;
    if (!right.length) return left.length;
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
        let diagonal = previous[0];
        previous[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
            const before = previous[j];
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);
            diagonal = before;
        }
    }
    return previous[right.length];
};

const fuzzyTextScore = (source, target) => {
    const sourceKey = normalizeKey(source);
    const targetKey = normalizeKey(target);
    if (!sourceKey || !targetKey) return 0;
    if (sourceKey === targetKey) return 1;

    const sourceTokens = new Set(tokenizeForMatch(source));
    const targetTokens = new Set(tokenizeForMatch(target));
    const intersection = [...sourceTokens].filter((token) => targetTokens.has(token)).length;
    const union = new Set([...sourceTokens, ...targetTokens]).size || 1;
    const tokenScore = intersection / union;
    const distance = levenshteinDistance(sourceKey, targetKey);
    const charScore = 1 - (distance / Math.max(sourceKey.length, targetKey.length, 1));
    const containsBoost = sourceKey.includes(targetKey) || targetKey.includes(sourceKey) ? 0.16 : 0;
    return Math.min(1, (tokenScore * 0.62) + (charScore * 0.38) + containsBoost);
};

const findBestFuzzyMapping = (source, candidates, fields, excludedIds = []) => {
    const excluded = new Set((excludedIds || []).map(String));
    let best = null;
    candidates.forEach((item) => {
        if (excluded.has(String(item?.id ?? ""))) return;
        const score = Math.max(...fields.map((field) => fuzzyTextScore(source, item?.[field])));
        if (!best || score > best.score) best = { item, score };
    });
    return best && best.score >= 0.34 ? best : null;
};

const buildCustomerRecordKey = (row) => [
    normalizeKey(row.cari_firma_id || row.firma_unvani),
    normalizeKey(row.proje_karti_id || row.proje_adi),
    normalizeKey(row.urun_id),
    normalizeKey(row.hizmet_tipi),
    normalizeKey(row.alt_hizmet_tipi),
    normalizeKey(row.erp_proje_kodu),
].join("::");

const pad = (value) => String(value).padStart(2, "0");

const excelDateToText = (value) => {
    if (value === null || value === undefined || value === "") return "";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${pad(value.getDate())}.${pad(value.getMonth() + 1)}.${value.getFullYear()}`;
    }

    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed) return `${pad(parsed.d)}.${pad(parsed.m)}.${parsed.y}`;
    }

    return normalize(value);
};

const parseOrderDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const text = excelDateToText(value);
    const match = String(text).match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if (match) {
        const [, day, month, year] = match;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addOrderDays = (date, days) => new Date(date.getTime() + days * 86400000);

const hydrateOrderDates = (row) => {
    const siparisDate = parseOrderDate(row?.["Sipariş Tarihi"]);
    if (!siparisDate) return { ...row };
    return {
        ...row,
        ["Sipariş Tarihi"]: excelDateToText(siparisDate),
        ["Yükleme Tarihi"]: excelDateToText(siparisDate),
        ["Teslim Tarihi"]: excelDateToText(addOrderDays(siparisDate, 1)),
    };
};

const hydrateOrderDefaults = (row) => ({
    ...row,
    ["Kap Adet"]: normalize(row?.["Kap Adet"]) || "25",
    ["Ambalaj Tipi"]: normalize(row?.["Ambalaj Tipi"]) || "1",
    ["Brüt KG"]: normalize(row?.["Brüt KG"]) || "25.000",
});

const findIncomingName = (row) =>
    normalize(
        row?.__sourceDeliveryAddressName ||
        row?.["Teslim Firma Adres Adı"] ||
        row?.["Alıcı Firma Cari Adı"]
    );

const createHeaderMap = (headers) => {
    const map = new Map();
    headers.forEach((header, index) => {
        map.set(normalizeHeader(header), index);
    });
    return map;
};

export default function YeniSiparis() {
    const fileInputRef = useRef(null);
    const customerExcelRef = useRef(null);
    const mappingExcelRef = useRef(null);

    const [activeTab, setActiveTab] = useState("orders");
    const [rows, setRows] = useState([]);
    const [fileName, setFileName] = useState("");
    const [customerProjects, setCustomerProjects] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [mappings, setMappings] = useState([]);
    const [loadingMappings, setLoadingMappings] = useState(true);
    const [mappingSearch, setMappingSearch] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState(emptyMapping());
    const [creating, setCreating] = useState(false);
    const [newValues, setNewValues] = useState(emptyMapping());
    const [saving, setSaving] = useState(false);
    const [mappingDeletingId, setMappingDeletingId] = useState(null);
    const [mappingImporting, setMappingImporting] = useState(false);
    const [mappingImportProgress, setMappingImportProgress] = useState(0);
    const [mappingImportStatus, setMappingImportStatus] = useState("");
    const [message, setMessage] = useState(null);
    const [customerRecords, setCustomerRecords] = useState([]);
    const [customerSearch, setCustomerSearch] = useState("");
    const [customerFormOpen, setCustomerFormOpen] = useState(false);
    const [customerEditingId, setCustomerEditingId] = useState(null);
    const [customerForm, setCustomerForm] = useState(emptyCustomer());
    const [customerSaving, setCustomerSaving] = useState(false);
    const [customerDeletingId, setCustomerDeletingId] = useState(null);
    const [customerImporting, setCustomerImporting] = useState(false);
    const [customerImportProgress, setCustomerImportProgress] = useState(0);
    const [customerImportStatus, setCustomerImportStatus] = useState("");
    const [mappingAliases, setMappingAliases] = useState(() => {
        if (typeof window === "undefined") return { delivery: {}, loading: {} };
        try {
            const saved = JSON.parse(window.localStorage.getItem("yeni-siparis-mapping-aliases") || "{}");
            return { delivery: saved.delivery || {}, loading: saved.loading || {} };
        } catch {
            return { delivery: {}, loading: {} };
        }
    });
    const [rejectedSuggestionIds, setRejectedSuggestionIds] = useState({});

    const showMessage = (type, text) => {
        setMessage({ type, text });
        window.clearTimeout(showMessage.timer);
        showMessage.timer = window.setTimeout(() => setMessage(null), 4500);
    };

    const fetchCustomers = async () => {
        setCustomersLoading(true);
        try {
            const pageSize = 1000;
            let from = 0;
            let records = [];

            while (true) {
                const { data, error } = await supabase
                    .from(CUSTOMER_TABLE)
                    .select("id, cari_firma_id, vkn, urun_id, proje_adi, proje_karti_id, firma_unvani, hizmet_tipi, alt_hizmet_tipi, erp_proje_kodu, kayit_anahtari, aktif, created_at, updated_at")
                    .eq("aktif", true)
                    .order("firma_unvani", { ascending: true })
                    .order("proje_adi", { ascending: true })
                    .range(from, from + pageSize - 1);

                if (error) throw error;
                const page = Array.isArray(data) ? data : [];
                records = records.concat(page);
                if (page.length < pageSize) break;
                from += pageSize;
            }

            setCustomerRecords(records);
            setCustomerProjects(
                records.map((item) => ({
                    ID: item.proje_karti_id || item.vkn || "",
                    FirmaUnvani: item.firma_unvani || "",
                    ProjeAdi: item.proje_adi || "",
                    UrunId: item.urun_id || "",
                    Vkn: item.vkn || "",
                    ProjeKartiId: item.proje_karti_id || "",
                    CariFirmaId: item.cari_firma_id || "",
                    HizmetTipi: item.hizmet_tipi || "",
                    AltHizmetTipi: item.alt_hizmet_tipi || "",
                    ErpProjeKodu: item.erp_proje_kodu || "",
                    __customerRowId: item.id,
                }))
            );
        } catch (error) {
            try {
                const { data: legacyData, error: legacyError } = await supabase
                    .from(LEGACY_CUSTOMER_TABLE)
                    .select("ID, FirmaUnvani, ProjeAdi")
                    .order("FirmaUnvani", { ascending: true })
                    .order("ProjeAdi", { ascending: true });

                if (legacyError) throw legacyError;
                const legacy = Array.isArray(legacyData) ? legacyData : [];
                setCustomerRecords([]);
                setCustomerProjects(legacy.map((item) => ({ ...item, __customerRowId: `legacy-${item.ID}-${item.ProjeAdi}` })));
                showMessage("error", "Müşteriler tablosuna ulaşılamadı. Geçici olarak eski müşteri kaynağı kullanılıyor; Tedarik-Analiz bağlantısını ve public.musteriler tablosunu kontrol edin.");
            } catch (legacyError) {
                showMessage("error", `Müşteri listesi alınamadı: ${legacyError?.message || error?.message || error}`);
                setCustomerRecords([]);
                setCustomerProjects([]);
            }
        } finally {
            setCustomersLoading(false);
        }
    };

    const fetchMappings = async () => {
        setLoadingMappings(true);
        try {
            const pageSize = 1000;
            let from = 0;
            let allRows = [];

            while (true) {
                const { data, error } = await supabase
                    .from(MAPPING_TABLE)
                    .select(
                        "id, musteriden_gelen, teslim_alan_firma, teslim_firmasi_id, teslim_noktasi_adi, teslim_noktasi_id, teslim_noktasi_il, teslim_noktasi_ilce"
                    )
                    .eq("aktif", true)
                    .order("musteriden_gelen", { ascending: true })
                    .range(from, from + pageSize - 1);

                if (error) throw error;
                const page = Array.isArray(data) ? data : [];
                allRows = allRows.concat(page);
                if (page.length < pageSize) break;
                from += pageSize;
            }

            setMappings(allRows);
        } catch (error) {
            showMessage("error", `Eşleştirme tablosu alınamadı: ${error?.message || error}`);
        } finally {
            setLoadingMappings(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
        fetchMappings();
    }, []);

    useEffect(() => {
        return () => window.clearTimeout(showMessage.timer);
    }, []);

    const customerOptions = useMemo(() => {
        const unique = new Map();
        customerProjects.forEach((item) => {
            const name = normalize(item?.FirmaUnvani);
            if (name && !unique.has(normalizeKey(name))) unique.set(normalizeKey(name), name);
        });
        return Array.from(unique.values()).sort((a, b) =>
            a.localeCompare(b, "tr", { sensitivity: "base" })
        );
    }, [customerProjects]);

    const projectsForCustomer = useMemo(() => {
        const filtered = customerProjects.filter(
            (item) => normalizeKey(item?.FirmaUnvani) === normalizeKey(selectedCustomer)
        );
        const unique = new Map();
        filtered.forEach((item) => {
            const key = [normalizeKey(item?.ProjeAdi), normalizeKey(item?.ProjeKartiId || item?.Vkn || item?.ID)].join("::");
            if (!unique.has(key)) unique.set(key, item);
        });
        return Array.from(unique.values());
    }, [customerProjects, selectedCustomer]);

    const selectedProject = useMemo(() =>
        projectsForCustomer.find((item) => String(item?.__customerRowId ?? item?.ID ?? "") === String(selectedProjectId)) || null,
    [projectsForCustomer, selectedProjectId]);

    useEffect(() => {
        setRows([]);
        setFileName("");

        if (!selectedCustomer) {
            setSelectedProjectId("");
            return;
        }

        if (projectsForCustomer.length === 1) {
            setSelectedProjectId(String(projectsForCustomer[0]?.__customerRowId ?? projectsForCustomer[0]?.ID ?? ""));
        } else {
            setSelectedProjectId("");
        }
    }, [selectedCustomer, projectsForCustomer.length]);

    const resolveCustomerRecord = (customerName) => {
        // Proje adı seçtirmiyoruz. Müşteri bulunduğu anda musteriler tablosundaki
        // gerçek satırı kullanıp VKN / Ürün ID / Proje Kartı ID değerlerini aynı satırdan alıyoruz.
        const matches = customerProjects.filter((item) =>
            normalizeKey(item?.FirmaUnvani) === normalizeKey(customerName)
        );
        return { record: matches[0] || null, candidates: matches };
    };

    const hydrateRowFromCustomer = (row, customerName, projectName) => {
        const { record, candidates } = resolveCustomerRecord(customerName);
        const resolvedProjectName = record?.ProjeAdi || projectName || "";
        const next = { ...row, __customerName: customerName, __projectName: resolvedProjectName };

        next["Vkn"] = record ? String(record?.Vkn || "") : "";
        // Sipariş Oluştur'daki Proje alanına öncelikle müşteriler tablosundaki Proje Kartı ID yazılır.
        next["Proje"] = record
            ? String(record?.ProjeKartiId || record?.ErpProjeKodu || projectName || "")
            : "";
        next["Ürün"] = record ? String(record?.UrunId || "") : "";
        next.__customerRecord = record;
        next.__cariFirmaId = record?.CariFirmaId || "";
        next.__projeKartiId = record?.ProjeKartiId || "";
        next.__erpProjeKodu = record?.ErpProjeKodu || "";
        next.__urunId = record?.UrunId || "";
        next.__customerResolved = Boolean(record);
        return next;
    };

    const detectCustomerNameFromOrderRow = (row) => {
        const preferredFields = [
            row?.["Yükleme Firması Adı"],
            row?.["Alıcı Firma Cari Adı"],
            row?.["Teslim Firma Adres Adı"],
        ].map(normalize).filter(Boolean);

        for (const value of preferredFields) {
            const exact = customerOptions.find((name) => normalizeKey(name) === normalizeKey(value));
            if (exact) return exact;
        }
        return "";
    };

    const updateOrderRow = (rowIndex, patch) => {
        setRows((current) => current.map((row, index) => {
            if (index !== rowIndex) return row;
            const next = { ...row, ...patch };
            return Object.prototype.hasOwnProperty.call(patch, "Sipariş Tarihi")
                ? hydrateOrderDates(next)
                : next;
        }));
    };

    const updateOrderCustomer = (rowIndex, customerName) => {
        setRows((current) => current.map((row, index) => {
            if (index !== rowIndex) return row;
            return hydrateRowFromCustomer(row, customerName, "");
        }));
    };

    const addManualOrderRow = () => {
        const row = {};
        TEMPLATE_HEADERS.forEach((header) => { row[header] = ""; });
        row = hydrateOrderDefaults(row);
        row.__customerName = "";
        row.__projectName = "";
        row.__customerResolved = false;
        row.__manual = true;
        setRows((current) => [...current, row]);
        setFileName((current) => current || "Manuel Sipariş Hazırlama");
    };

    const removeOrderRow = (rowIndex) => {
        setRows((current) => current.filter((_, index) => index !== rowIndex));
    };


    const mappingIndex = useMemo(() => {
        const map = new Map();
        mappings.forEach((item) => {
            const key = normalizeKey(item.musteriden_gelen);
            if (key && !map.has(key)) map.set(key, item);
        });
        return map;
    }, [mappings]);

    const loadingCompanyIndex = useMemo(() => {
        const map = new Map();
        mappings.forEach((item) => {
            // Yükleme Firması Adı, eşleştirme tablosundaki Müşteriden Gelen alanında aranır.
            // Eşleşme bulunduğunda siparişe Teslim Noktası ID yazılır.
            const key = normalizeKey(item.musteriden_gelen);
            if (key && item.teslim_noktasi_id && !map.has(key)) map.set(key, item);
        });
        return map;
    }, [mappings]);

    const mappingsById = useMemo(() => {
        const map = new Map();
        mappings.forEach((item) => map.set(String(item?.id ?? ""), item));
        return map;
    }, [mappings]);

    const resolveAliasMapping = (kind, source) => {
        const sourceKey = normalizeKey(source);
        const mappingId = mappingAliases?.[kind]?.[sourceKey];
        return mappingId ? mappingsById.get(String(mappingId)) || null : null;
    };

    const applyDeliveryMappings = (row, sourceDeliveryAddress, sourceLoadingCompany) => {
        const next = { ...row };
        const deliveryName = normalize(sourceDeliveryAddress);
        const loadingCompanyName = normalize(sourceLoadingCompany);

        next.__sourceDeliveryAddressName = deliveryName;
        next.__sourceLoadingCompanyName = loadingCompanyName;

        const deliveryMapping = deliveryName
            ? mappingIndex.get(normalizeKey(deliveryName)) || resolveAliasMapping("delivery", deliveryName) || null
            : null;
        const loadingMapping = loadingCompanyName
            ? loadingCompanyIndex.get(normalizeKey(loadingCompanyName)) || resolveAliasMapping("loading", loadingCompanyName) || null
            : null;

        if (deliveryMapping) {
            next["Teslim Firma Adres Adı"] = normalize(deliveryMapping.teslim_noktasi_id);
            next["Alıcı Firma Cari Adı"] = normalize(deliveryMapping.teslim_firmasi_id);
            next.__deliveryMapping = deliveryMapping;
        }

        if (loadingMapping) {
            next["Yükleme Firması Adı"] = normalize(loadingMapping.teslim_noktasi_id);
            next.__loadingMapping = loadingMapping;
        }

        return next;
    };

    const preparedRows = useMemo(
        () =>
            rows.map((row, index) => {
                const incoming = findIncomingName(row);
                const mapping = row.__deliveryMapping || mappingIndex.get(normalizeKey(incoming)) || resolveAliasMapping("delivery", incoming) || null;
                const sourceLoadingCompany = normalize(row.__sourceLoadingCompanyName || row["Yükleme Firması Adı"]);
                const loadingMapping = row.__loadingMapping || loadingCompanyIndex.get(normalizeKey(sourceLoadingCompany)) || resolveAliasMapping("loading", sourceLoadingCompany) || null;
                const directCariId = normalize(row?.["Alıcı Firma Cari Adı"]);
                const directAddressId = normalize(row?.["Teslim Firma Adres Adı"]);
                const directLoadingId = normalize(row?.["Yükleme Firması Adı"]);
                const hasDirectIds = /^\d+$/.test(directCariId) && /^\d+$/.test(directAddressId);
                const hasLoadingId = !sourceLoadingCompany || /^\d+$/.test(directLoadingId);

                const customerResolved = row.__customerResolved !== false && Boolean(normalize(row["Vkn"]) && normalize(row["Proje"]));
                const deliveryResolved = Boolean(
                    hasDirectIds ||
                    (incoming && mapping?.teslim_firmasi_id && mapping?.teslim_noktasi_id)
                );
                const loadingResolved = Boolean(hasLoadingId || loadingMapping?.teslim_noktasi_id);
                const ready = customerResolved && deliveryResolved && loadingResolved;

                return {
                    ...row,
                    __index: index,
                    __incoming: incoming,
                    __mapping: mapping,
                    __loadingMapping: loadingMapping,
                    __ready: ready,
                };
            }),
        [rows, mappingIndex, loadingCompanyIndex, mappingAliases, mappingsById]
    );

    const readyCount = preparedRows.filter((row) => row.__ready).length;
    const waitingCount = preparedRows.length - readyCount;
    const allReady = preparedRows.length > 0 && waitingCount === 0;

    const mappingSuggestions = useMemo(() => {
        const suggestions = [];
        const seen = new Set();

        preparedRows.forEach((row) => {
            const deliverySource = normalize(row.__sourceDeliveryAddressName || row.__incoming);
            if (deliverySource && !row.__mapping) {
                const key = `delivery::${normalizeKey(deliverySource)}`;
                if (!seen.has(key)) {
                    const best = findBestFuzzyMapping(
                        deliverySource,
                        mappings.filter((item) => item.teslim_firmasi_id && item.teslim_noktasi_id),
                        ["musteriden_gelen", "teslim_noktasi_adi"],
                        rejectedSuggestionIds[key]
                    );
                    if (best) suggestions.push({ key, kind: "delivery", source: deliverySource, ...best });
                    seen.add(key);
                }
            }

            const loadingSource = normalize(row.__sourceLoadingCompanyName);
            if (loadingSource && !row.__loadingMapping && !/^\d+$/.test(normalize(row["Yükleme Firması Adı"]))) {
                const key = `loading::${normalizeKey(loadingSource)}`;
                if (!seen.has(key)) {
                    const best = findBestFuzzyMapping(
                        loadingSource,
                        mappings.filter((item) => item.musteriden_gelen && item.teslim_noktasi_id),
                        ["musteriden_gelen", "teslim_noktasi_adi"],
                        rejectedSuggestionIds[key]
                    );
                    if (best) suggestions.push({ key, kind: "loading", source: loadingSource, ...best });
                    seen.add(key);
                }
            }
        });

        return suggestions;
    }, [preparedRows, mappings, rejectedSuggestionIds]);

    const acceptMappingSuggestion = (suggestion) => {
        const sourceKey = normalizeKey(suggestion.source);
        const mappingId = String(suggestion.item?.id ?? "");
        if (!sourceKey || !mappingId) return;

        const nextAliases = {
            ...mappingAliases,
            [suggestion.kind]: {
                ...(mappingAliases?.[suggestion.kind] || {}),
                [sourceKey]: mappingId,
            },
        };
        setMappingAliases(nextAliases);
        if (typeof window !== "undefined") {
            window.localStorage.setItem("yeni-siparis-mapping-aliases", JSON.stringify(nextAliases));
        }

        setRows((current) => current.map((row) => {
            const rowSource = suggestion.kind === "delivery"
                ? normalize(row.__sourceDeliveryAddressName || findIncomingName(row))
                : normalize(row.__sourceLoadingCompanyName || row["Yükleme Firması Adı"]);
            if (normalizeKey(rowSource) !== sourceKey) return row;
            const next = { ...row };
            if (suggestion.kind === "delivery") {
                next["Teslim Firma Adres Adı"] = normalize(suggestion.item.teslim_noktasi_id);
                next["Alıcı Firma Cari Adı"] = normalize(suggestion.item.teslim_firmasi_id);
                next.__deliveryMapping = suggestion.item;
            } else {
                next["Yükleme Firması Adı"] = normalize(suggestion.item.teslim_noktasi_id);
                next.__loadingMapping = suggestion.item;
            }
            return next;
        }));
        showMessage("success", `“${suggestion.source}” eşleştirildi ve aynı değer geçen satırlara uygulandı.`);
    };

    const rejectMappingSuggestion = (suggestion) => {
        const mappingId = String(suggestion.item?.id ?? "");
        setRejectedSuggestionIds((current) => ({
            ...current,
            [suggestion.key]: [...new Set([...(current[suggestion.key] || []), mappingId])],
        }));
    };

    const parseExcel = async (file) => {
        if (!file) return;

        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!["xlsx", "xls", "xlsm"].includes(ext)) {
            showMessage("error", "Lütfen .xlsx, .xls veya .xlsm uzantılı bir Excel dosyası yükleyin.");
            return;
        }

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const table = XLSX.utils.sheet_to_json(firstSheet, {
                header: 1,
                defval: "",
                raw: false,
            });

            if (!table.length) throw new Error("Excel dosyası boş.");

            let headerRowIndex = -1;
            let headerMap = null;

            for (let i = 0; i < Math.min(table.length, 25); i += 1) {
                const map = createHeaderMap(table[i]);
                const found = ORDER_INPUT_HEADERS.filter((header) =>
                    map.has(normalizeHeader(header))
                ).length;

                if (found >= 6) {
                    headerRowIndex = i;
                    headerMap = map;
                    break;
                }
            }

            if (headerRowIndex < 0 || !headerMap) {
                throw new Error("Şablon başlıkları bulunamadı. Yeni Sipariş örnek şablonunu kullanın.");
            }

            const missing = REQUIRED_IMPORT_HEADERS.filter(
                (header) => !headerMap.has(normalizeHeader(header))
            );
            if (missing.length) {
                throw new Error(`Eksik zorunlu kolon: ${missing.join(", ")}`);
            }

            const sourceRows = table
                .slice(headerRowIndex + 1)
                .map((sourceRow) => {
                    const input = {};
                    ORDER_INPUT_HEADERS.forEach((header) => {
                        const index = headerMap.get(normalizeHeader(header));
                        const value = index === undefined ? "" : (sourceRow[index] ?? "");
                        input[header] = DATE_HEADERS.has(header)
                            ? excelDateToText(value)
                            : normalize(value);
                    });
                    return input;
                })
                .filter((row) => ORDER_INPUT_HEADERS.some((header) => normalize(row[header]) !== ""));

            if (!sourceRows.length) throw new Error("Excel dosyasında sipariş satırı bulunamadı.");

            const result = sourceRows.map((input) => {
                let row = {};
                TEMPLATE_HEADERS.forEach((header) => { row[header] = ""; });

                row["Sipariş Tarihi"] = excelDateToText(input["Sipariş Tarihi"]);
                row["Müşteri Sipariş No"] = normalize(input["Müşteri Sipariş No"]);
                row["İstenilen Araç Tipi"] = normalizeVehicleType(input["İstenilen Araç Tipi"]);
                row["Açıklama"] = normalize(input["Açıklama"]);
                const sourceLoadingCompany = normalize(input["Yükleme Firması Adı"]);
                const sourceDeliveryAddress = normalize(input["Teslim FirmaAdres Adı"]);
                row["Yükleme Firması Adı"] = sourceLoadingCompany;
                row["Teslim Firma Adres Adı"] = sourceDeliveryAddress;

                row = hydrateOrderDates(row);
                row = hydrateOrderDefaults(row);
                row = applyDeliveryMappings(row, sourceDeliveryAddress, sourceLoadingCompany);

                const excelCustomerName = normalize(input["Müşteri Adı"]);
                const detectedCustomerName = customerOptions.find(
                    (name) => normalizeKey(name) === normalizeKey(excelCustomerName)
                ) || excelCustomerName;

                if (detectedCustomerName) {
                    row = hydrateRowFromCustomer(row, detectedCustomerName, "");
                } else {
                    row.__customerName = "";
                    row.__projectName = "";
                    row.__customerResolved = false;
                }
                return row;
            });

            setRows(result);
            setFileName(file.name);
            setActiveTab("orders");
            const autoMatched = result.filter((row) => row.__customerResolved).length;
            showMessage("success", `${result.length} sipariş içeri alındı. ${autoMatched} satırda müşteri Excel'deki firma adından otomatik eşleşti; VKN, Proje ve Ürün otomatik dolduruldu.`);
        } catch (error) {
            showMessage("error", error?.message || "Excel dosyası okunamadı.");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (file) parseExcel(file);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) parseExcel(file);
    };

    const customerReferenceHeaders = [
        "Cari Firma ID",
        "VKN",
        "Ürün ID",
        "Proje Adı",
        "Proje Kartı ID",
        "Firma Ünvanı",
        "Hizmet Tipi",
        "Alt Hizmet Tipi",
        "ERP Proje Kodu",
    ];

    const buildCustomerReferenceRows = () =>
        customerRecords.map((item) => ({
            "Cari Firma ID": item.cari_firma_id || "",
            "VKN": item.vkn || "",
            "Ürün ID": item.urun_id || "",
            "Proje Adı": item.proje_adi || "",
            "Proje Kartı ID": item.proje_karti_id || "",
            "Firma Ünvanı": item.firma_unvani || "",
            "Hizmet Tipi": item.hizmet_tipi || "",
            "Alt Hizmet Tipi": item.alt_hizmet_tipi || "",
            "ERP Proje Kodu": item.erp_proje_kodu || "",
        }));

    const mappingReferenceHeaders = MAPPING_COLUMNS.map(({ label }) => label);

    const buildMappingReferenceRows = () =>
        mappings.map((item) => ({
            "Müşteriden Gelen": item.musteriden_gelen || "",
            "Teslim Alan Firma": item.teslim_alan_firma || "",
            "Teslim Firması ID": item.teslim_firmasi_id || "",
            "Teslim Noktası Adı": item.teslim_noktasi_adi || "",
            "Teslim Noktası ID": item.teslim_noktasi_id || "",
            "Teslim Noktası İl": item.teslim_noktasi_il || "",
            "Teslim Noktası İlçe": item.teslim_noktasi_ilce || "",
        }));

    const createMappingReferenceSheet = () => {
        const worksheet = XLSX.utils.json_to_sheet(buildMappingReferenceRows(), {
            header: mappingReferenceHeaders,
        });
        worksheet["!cols"] = mappingReferenceHeaders.map((header) => ({
            wch: Math.max(16, Math.min(42, header.length + 8)),
        }));
        return worksheet;
    };

    const downloadTemplate = async () => {
        if (!customerRecords.length) {
            showMessage("error", "Şablona eklenecek aktif müşteri kaydı bulunamadı.");
            return;
        }

        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = "Odak Lojistik";
            workbook.created = new Date();

            const orderSheet = workbook.addWorksheet("Sipariş Girişi");
            orderSheet.addRow(ORDER_INPUT_HEADERS);
            orderSheet.addRow([
                customerRecords[0]?.firma_unvani || "Örnek Müşteri A.Ş.",
                "08.09.2026",
                "SIP-0001",
                "TIR",
                "Örnek sipariş açıklaması",
                "Yükleme Firması",
                "Teslim Noktası",
            ]);
            orderSheet.columns = ORDER_INPUT_HEADERS.map((header) => ({
                key: header,
                width: Math.max(14, Math.min(36, header.length + 6)),
            }));
            orderSheet.views = [{ state: "frozen", ySplit: 1 }];
            orderSheet.getRow(1).font = { bold: true };
            orderSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ORDER_INPUT_HEADERS.length } };

            const vehicleColumnIndex = ORDER_INPUT_HEADERS.indexOf("İstenilen Araç Tipi") + 1;
            const vehicleFormula = `"${VEHICLE_TYPE_OPTIONS.map((item) => item.label).join(",")}"`;
            for (let rowNumber = 2; rowNumber <= 2000; rowNumber += 1) {
                orderSheet.getCell(rowNumber, vehicleColumnIndex).dataValidation = {
                    type: "list",
                    allowBlank: true,
                    formulae: [vehicleFormula],
                    showErrorMessage: true,
                    errorTitle: "Geçersiz araç tipi",
                    error: "Listeden TIR, ONTEKER, KIRKAYAK veya H.KAMYON seçin.",
                };
            }

            const customerSheet = workbook.addWorksheet("Müşteri Adları");
            customerSheet.addRow(customerReferenceHeaders);
            buildCustomerReferenceRows().forEach((row) => {
                customerSheet.addRow(customerReferenceHeaders.map((header) => row[header] ?? ""));
            });
            customerSheet.columns = customerReferenceHeaders.map((header) => ({
                key: header,
                width: Math.max(14, Math.min(42, header.length + 8)),
            }));
            customerSheet.getRow(1).font = { bold: true };
            customerSheet.views = [{ state: "frozen", ySplit: 1 }];

            const mappingSheet = workbook.addWorksheet("Teslim Noktaları");
            mappingSheet.addRow(mappingReferenceHeaders);
            buildMappingReferenceRows().forEach((row) => {
                mappingSheet.addRow(mappingReferenceHeaders.map((header) => row[header] ?? ""));
            });
            mappingSheet.columns = mappingReferenceHeaders.map((header) => ({
                key: header,
                width: Math.max(16, Math.min(42, header.length + 8)),
            }));
            mappingSheet.getRow(1).font = { bold: true };
            mappingSheet.views = [{ state: "frozen", ySplit: 1 }];

            const vehicleSheet = workbook.addWorksheet("Araç Tipleri");
            vehicleSheet.addRow(["Araç Tipi", "Kod"]);
            VEHICLE_TYPE_OPTIONS.forEach((item) => vehicleSheet.addRow([item.label, item.code]));
            vehicleSheet.getRow(1).font = { bold: true };
            vehicleSheet.columns = [{ width: 18 }, { width: 10 }];

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "Yeni_Siparis_Giris_Sablonu.xlsx";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);

            showMessage(
                "success",
                `Şablon indirildi. İstenilen Araç Tipi kolonu Excel açılır listesinden seçilebilir: TIR→21, ONTEKER→3, KIRKAYAK→2, H.KAMYON→4. Müşteri Adları ve Teslim Noktaları referans sekmeleri de eklendi.`
            );
        } catch (error) {
            showMessage("error", `Şablon hazırlanamadı: ${error.message}`);
        }
    };


    const downloadCustomerList = () => {
        if (!customerRecords.length) {
            showMessage("error", "İndirilecek aktif müşteri kaydı bulunamadı.");
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(buildCustomerReferenceRows(), { header: customerReferenceHeaders });
        worksheet["!cols"] = customerReferenceHeaders.map((header) => ({ wch: Math.max(14, Math.min(42, header.length + 8)) }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Müşteri Listesi");
        XLSX.writeFile(workbook, `Musteri_Listesi_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showMessage("success", `${customerRecords.length} aktif müşteri/proje kaydı Excel olarak indirildi.`);
    };

    const exportExcel = () => {
        if (!preparedRows.length) {
            showMessage("error", "Excel'e aktarılacak sipariş bulunmuyor.");
            return;
        }

        const previewHeaders = [...TEMPLATE_HEADERS];
        const exportRows = preparedRows.map((row) => {
            const output = {};
            TEMPLATE_HEADERS.forEach((header) => {
                output[header] = row[header] ?? "";
            });
            return output;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: previewHeaders });
        worksheet["!cols"] = previewHeaders.map((header) => ({
            wch: Math.max(10, Math.min(34, String(header).length + 6)),
        }));

        const mappingSheet = createMappingReferenceSheet();
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sipariş Önizleme");
        XLSX.utils.book_append_sheet(workbook, mappingSheet, "Teslim Noktaları");
        const bugun = new Date();
        const gun = String(bugun.getDate()).padStart(2, "0");
        const ay = String(bugun.getMonth() + 1).padStart(2, "0");
        const yil = bugun.getFullYear();
        const dosyaAdi = `TMS_SİPARİŞ_${gun}.${ay}.${yil}.xlsx`;

        XLSX.writeFile(workbook, dosyaAdi);
        showMessage("success", `Sipariş Önizleme tablosundaki standart 20 kolon Excel'e birebir aktarıldı; Teslim Noktaları sekmesine ${mappings.length} aktif eşleştirme kaydı eklendi.`);
    };

    const beginEdit = (row) => {
        setCreating(false);
        setEditingId(row.id);
        setEditValues({
            musteriden_gelen: row.musteriden_gelen || "",
            teslim_alan_firma: row.teslim_alan_firma || "",
            teslim_firmasi_id: row.teslim_firmasi_id || "",
            teslim_noktasi_adi: row.teslim_noktasi_adi || "",
            teslim_noktasi_id: row.teslim_noktasi_id || "",
            teslim_noktasi_il: row.teslim_noktasi_il || "",
            teslim_noktasi_ilce: row.teslim_noktasi_ilce || "",
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValues(emptyMapping());
    };

    const beginCreate = () => {
        cancelEdit();
        setNewValues(emptyMapping());
        setCreating(true);
    };

    const validateMapping = (values) => {
        if (!normalize(values.musteriden_gelen)) return "Müşteriden Gelen alanı zorunlu.";
        if (!normalize(values.teslim_noktasi_adi)) return "Teslim Noktası Adı zorunlu.";
        if (!normalize(values.teslim_firmasi_id)) return "Teslim Firması ID zorunlu.";
        if (!normalize(values.teslim_noktasi_id)) return "Teslim Noktası ID zorunlu.";
        return "";
    };

    const saveNewMapping = async () => {
        const validation = validateMapping(newValues);
        if (validation) {
            showMessage("error", validation);
            return;
        }

        setSaving(true);
        try {
            const payload = Object.fromEntries(
                MAPPING_COLUMNS.map(({ key }) => [key, normalize(newValues[key])])
            );

            const { error } = await supabase.from(MAPPING_TABLE).insert(payload);
            if (error) throw error;

            setCreating(false);
            setNewValues(emptyMapping());
            await fetchMappings();
            showMessage("success", "Yeni eşleştirme kaydı eklendi.");
        } catch (error) {
            showMessage("error", `Kayıt eklenemedi: ${error?.message || error}`);
        } finally {
            setSaving(false);
        }
    };

    const saveEditMapping = async () => {
        const validation = validateMapping(editValues);
        if (validation) {
            showMessage("error", validation);
            return;
        }

        setSaving(true);
        try {
            const payload = Object.fromEntries(
                MAPPING_COLUMNS.map(({ key }) => [key, normalize(editValues[key])])
            );
            payload.updated_at = new Date().toISOString();

            const { error } = await supabase
                .from(MAPPING_TABLE)
                .update(payload)
                .eq("id", editingId);

            if (error) throw error;

            cancelEdit();
            await fetchMappings();
            showMessage("success", "Eşleştirme kaydı güncellendi.");
        } catch (error) {
            showMessage("error", `Kayıt güncellenemedi: ${error?.message || error}`);
        } finally {
            setSaving(false);
        }
    };

    const downloadMappingTemplate = () => {
        const headers = MAPPING_COLUMNS.map(({ label }) => label);
        const example = {
            "Müşteriden Gelen": "Örnek Teslim Noktası",
            "Teslim Alan Firma": "Örnek Firma A.Ş.",
            "Teslim Firması ID": "12345",
            "Teslim Noktası Adı": "Örnek Depo",
            "Teslim Noktası ID": "67890",
            "Teslim Noktası İl": "İstanbul",
            "Teslim Noktası İlçe": "Tuzla",
        };
        const ws = XLSX.utils.json_to_sheet([example], { header: headers });
        ws["!cols"] = headers.map((header) => ({ wch: Math.max(18, header.length + 4) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Eşleştirmeler");
        XLSX.writeFile(wb, "Esleştirme_Yukleme_Sablonu.xlsx");
        showMessage("success", "Eşleştirme Excel şablonu indirildi.");
    };

    const importMappingsFromExcel = async (file) => {
        if (!file) return;
        setMappingImporting(true);
        setMappingImportProgress(8);
        setMappingImportStatus("Excel okunuyor...");
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
            if (!matrix.length) throw new Error("Excel dosyası boş.");

            const aliases = Object.fromEntries(MAPPING_COLUMNS.map(({ key, label }) => [key, [label, key]]));
            let headerRowIndex = -1;
            let headerMap = null;
            for (let i = 0; i < Math.min(matrix.length, 30); i += 1) {
                const candidate = createHeaderMap(matrix[i]);
                const hasRequired = ["musteriden_gelen", "teslim_noktasi_adi"].every((key) =>
                    aliases[key].some((alias) => candidate.has(normalizeHeader(alias)))
                );
                if (hasRequired) { headerRowIndex = i; headerMap = candidate; break; }
            }
            if (headerRowIndex < 0 || !headerMap) {
                throw new Error("Müşteriden Gelen / Teslim Noktası Adı kolonları bulunamadı. Örnek şablonu indirip doldurun.");
            }

            const colIndex = {};
            MAPPING_COLUMNS.forEach(({ key }) => {
                const alias = aliases[key].find((item) => headerMap.has(normalizeHeader(item)));
                colIndex[key] = alias ? headerMap.get(normalizeHeader(alias)) : -1;
            });

            const parsed = matrix.slice(headerRowIndex + 1).map((row) => {
                const record = {};
                MAPPING_COLUMNS.forEach(({ key }) => {
                    record[key] = colIndex[key] >= 0 ? normalize(row[colIndex[key]]) : "";
                });
                return record;
            }).filter((row) => row.musteriden_gelen || row.teslim_noktasi_adi);

            if (!parsed.length) throw new Error("Aktarılacak eşleştirme kaydı bulunamadı.");
            setMappingImportProgress(34);

            const exactKey = (row) => MAPPING_COLUMNS.map(({ key }) => normalizeKey(row[key])).join("::");
            const existingKeys = new Set(mappings.map(exactKey));
            const unique = new Map();
            parsed.forEach((row) => unique.set(exactKey(row), row));
            const duplicateInFile = parsed.length - unique.size;
            const newRows = Array.from(unique.values()).filter((row) => !existingKeys.has(exactKey(row)));
            const existingSkipped = unique.size - newRows.length;

            if (!newRows.length) {
                setMappingImportProgress(100);
                setMappingImportStatus(`${parsed.length} satır okundu; yeni kayıt yok.`);
                showMessage("success", "Excel okundu; tüm kayıtlar zaten eşleştirme tablosunda mevcut.");
                return;
            }

            const chunkSize = 250;
            for (let i = 0; i < newRows.length; i += chunkSize) {
                const chunk = newRows.slice(i, i + chunkSize);
                const { error } = await supabase.from(MAPPING_TABLE).insert(chunk);
                if (error) throw error;
                const done = Math.min(i + chunk.length, newRows.length);
                setMappingImportProgress(40 + Math.round((done / newRows.length) * 55));
                setMappingImportStatus(`${done}/${newRows.length} kayıt aktarılıyor...`);
            }

            await fetchMappings();
            setMappingImportProgress(100);
            setMappingImportStatus(`${parsed.length} satır okundu · ${duplicateInFile} dosya içi tekrar · ${existingSkipped} mevcut kayıt atlandı · ${newRows.length} kayıt eklendi.`);
            showMessage("success", `${newRows.length} eşleştirme kaydı başarıyla aktarıldı.`);
        } catch (error) {
            setMappingImportStatus("");
            showMessage("error", `Eşleştirme Excel'i aktarılamadı: ${error?.message || error}`);
        } finally {
            setMappingImporting(false);
            if (mappingExcelRef.current) mappingExcelRef.current.value = "";
        }
    };

    const archiveMapping = async (row) => {
        if (!row?.id || mappingDeletingId) return;
        const approved = window.confirm(`“${row.musteriden_gelen || row.teslim_noktasi_adi || "Bu kayıt"}” eşleştirmesi silinsin mi?`);
        if (!approved) return;
        setMappingDeletingId(row.id);
        try {
            const { error } = await supabase
                .from(MAPPING_TABLE)
                .update({ aktif: false, updated_at: new Date().toISOString() })
                .eq("id", row.id);
            if (error) throw error;
            setMappings((prev) => prev.filter((item) => item.id !== row.id));
            if (editingId === row.id) cancelEdit();
            showMessage("success", "Eşleştirme kaydı silindi.");
        } catch (error) {
            showMessage("error", `Kayıt silinemedi: ${error?.message || error}`);
        } finally {
            setMappingDeletingId(null);
        }
    };

    const openCustomerCreate = () => {
        setCustomerEditingId(null);
        setCustomerForm(emptyCustomer());
        setCustomerFormOpen(true);
    };

    const openCustomerEdit = (record) => {
        setCustomerEditingId(record.id);
        setCustomerForm({
            cari_firma_id: record.cari_firma_id || "",
            vkn: record.vkn || "",
            urun_id: record.urun_id || "",
            proje_adi: record.proje_adi || "",
            proje_karti_id: record.proje_karti_id || "",
            firma_unvani: record.firma_unvani || "",
            hizmet_tipi: record.hizmet_tipi || "",
            alt_hizmet_tipi: record.alt_hizmet_tipi || "",
            erp_proje_kodu: record.erp_proje_kodu || "",
        });
        setCustomerFormOpen(true);
    };

    const saveCustomer = async () => {
        const firma = normalize(customerForm.firma_unvani);
        if (!firma) {
            showMessage("error", "Firma Ünvanı zorunlu.");
            return;
        }

        const payload = {
            cari_firma_id: normalize(customerForm.cari_firma_id),
            vkn: normalize(customerForm.vkn),
            urun_id: normalize(customerForm.urun_id),
            proje_adi: normalize(customerForm.proje_adi),
            proje_karti_id: normalize(customerForm.proje_karti_id),
            firma_unvani: firma,
            hizmet_tipi: normalize(customerForm.hizmet_tipi),
            alt_hizmet_tipi: normalize(customerForm.alt_hizmet_tipi),
            erp_proje_kodu: normalize(customerForm.erp_proje_kodu),
            aktif: true,
            updated_at: new Date().toISOString(),
        };
        payload.kayit_anahtari = buildCustomerRecordKey(payload);

        setCustomerSaving(true);
        try {
            const query = customerEditingId
                ? supabase.from(CUSTOMER_TABLE).update(payload).eq("id", customerEditingId)
                : supabase.from(CUSTOMER_TABLE).insert(payload);
            const { error } = await query;
            if (error) throw error;

            setCustomerFormOpen(false);
            setCustomerEditingId(null);
            setCustomerForm(emptyCustomer());
            await fetchCustomers();
            showMessage("success", customerEditingId ? "Müşteri kaydı güncellendi." : "Yeni müşteri kaydı eklendi.");
        } catch (error) {
            showMessage("error", `Müşteri kaydedilemedi: ${error?.message || error}`);
        } finally {
            setCustomerSaving(false);
        }
    };

    const archiveCustomer = async (record) => {
        if (!window.confirm(`${record.firma_unvani} kaydını pasife almak istiyor musunuz?`)) return;
        setCustomerDeletingId(record.id);
        try {
            const { error } = await supabase
                .from(CUSTOMER_TABLE)
                .update({ aktif: false, updated_at: new Date().toISOString() })
                .eq("id", record.id);
            if (error) throw error;
            await fetchCustomers();
            showMessage("success", "Müşteri kaydı pasife alındı.");
        } catch (error) {
            showMessage("error", `Müşteri silinemedi: ${error?.message || error}`);
        } finally {
            setCustomerDeletingId(null);
        }
    };

    const findCustomerHeaderIndex = (row, aliases) => {
        const normalizedAliases = aliases.map(normalizeHeader);
        return row.findIndex((cell) => normalizedAliases.includes(normalizeHeader(cell)));
    };

    const downloadCustomerTemplate = () => {
        const headers = ["Cari Firma ID", "VKN", "Ürün ID", "Proje Adı", "Proje Kartı ID", "Firma Ünvanı", "Hizmet Tipi", "Alt Hizmet Tipi", "Erp Proje Kodu"];
        const example = ["CF-1001", "1234567890", "URN-001", "Örnek Proje", "PRJ-001", "Örnek Müşteri A.Ş.", "FTL", "Standart", "ERP-PRJ-001"];
        const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
        worksheet["!cols"] = [
            { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 26 }, { wch: 18 },
            { wch: 34 }, { wch: 20 }, { wch: 22 }, { wch: 18 },
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Müşteriler");
        XLSX.writeFile(workbook, "Musteri_Yukleme_Sablonu.xlsx");
        showMessage("success", "Müşteri Excel şablonu indirildi. Örnek satırı silip kendi verilerinizi doldurabilirsiniz.");
    };

    const importCustomersFromExcel = async (file) => {
        if (!file) return;
        setCustomerImporting(true);
        setCustomerImportProgress(8);
        setCustomerImportStatus("Excel dosyası okunuyor...");

        try {
            const buffer = await file.arrayBuffer();
            setCustomerImportProgress(22);
            const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const table = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
            if (!table.length) throw new Error("Excel dosyası boş.");

            setCustomerImportStatus("Müşteri / proje başlıkları bulunuyor...");
            setCustomerImportProgress(36);

            let headerRowIndex = -1;
            let columnIndexes = null;
            for (let i = 0; i < Math.min(table.length, 30); i += 1) {
                const firmaIndex = findCustomerHeaderIndex(table[i], CUSTOMER_IMPORT_ALIASES.firma_unvani);
                const projeIndex = findCustomerHeaderIndex(table[i], CUSTOMER_IMPORT_ALIASES.proje_adi);
                if (firmaIndex >= 0) {
                    headerRowIndex = i;
                    columnIndexes = {
                        cari_firma_id: findCustomerHeaderIndex(table[i], CUSTOMER_IMPORT_ALIASES.cari_firma_id),
                        vkn: findCustomerHeaderIndex(table[i], CUSTOMER_IMPORT_ALIASES.vkn),
                        urun_id: findCustomerHeaderIndex(table[i], CUSTOMER_IMPORT_ALIASES.urun_id),
                        proje_adi: projeIndex,
                        proje_karti_id: findCustomerHeaderIndex(table[i], CUSTOMER_IMPORT_ALIASES.proje_karti_id),
                        firma_unvani: firmaIndex,
                        hizmet_tipi: findCustomerHeaderIndex(table[i], CUSTOMER_IMPORT_ALIASES.hizmet_tipi),
                        alt_hizmet_tipi: findCustomerHeaderIndex(table[i], CUSTOMER_IMPORT_ALIASES.alt_hizmet_tipi),
                        erp_proje_kodu: findCustomerHeaderIndex(table[i], CUSTOMER_IMPORT_ALIASES.erp_proje_kodu),
                    };
                    break;
                }
            }

            if (headerRowIndex < 0 || !columnIndexes) {
                throw new Error("Firma Ünvanı / Müşteri kolonu bulunamadı. Örnek dosyadaki başlıkları kullanın.");
            }

            const imported = table
                .slice(headerRowIndex + 1)
                .map((row) => {
                    const record = {
                        cari_firma_id: columnIndexes.cari_firma_id >= 0 ? normalize(row[columnIndexes.cari_firma_id]) : "",
                        vkn: columnIndexes.vkn >= 0 ? normalize(row[columnIndexes.vkn]) : "",
                        urun_id: columnIndexes.urun_id >= 0 ? normalize(row[columnIndexes.urun_id]) : "",
                        proje_adi: columnIndexes.proje_adi >= 0 ? normalize(row[columnIndexes.proje_adi]) : "",
                        proje_karti_id: columnIndexes.proje_karti_id >= 0 ? normalize(row[columnIndexes.proje_karti_id]) : "",
                        firma_unvani: normalize(row[columnIndexes.firma_unvani]),
                        hizmet_tipi: columnIndexes.hizmet_tipi >= 0 ? normalize(row[columnIndexes.hizmet_tipi]) : "",
                        alt_hizmet_tipi: columnIndexes.alt_hizmet_tipi >= 0 ? normalize(row[columnIndexes.alt_hizmet_tipi]) : "",
                        erp_proje_kodu: columnIndexes.erp_proje_kodu >= 0 ? normalize(row[columnIndexes.erp_proje_kodu]) : "",
                        aktif: true,
                        updated_at: new Date().toISOString(),
                    };
                    record.kayit_anahtari = buildCustomerRecordKey(record);
                    return record;
                })
                .filter((row) => row.firma_unvani);

            if (!imported.length) throw new Error("Excel'de aktarılabilir müşteri kaydı bulunamadı.");

            // PostgreSQL tek bir UPSERT komutunda aynı conflict anahtarını iki kez
            // güncelleyemez. Gerçek operasyon alanlarından üretilen kayit_anahtari ile
            // Excel tekrarlarını önce tek kayıtta birleştiriyoruz.
            const dedupedMap = new Map();
            imported.forEach((row) => {
                const key = row.kayit_anahtari;
                const previous = dedupedMap.get(key);
                if (!previous) {
                    dedupedMap.set(key, row);
                    return;
                }

                // Aynı müşteri/proje/ürün tekrarında son dolu Excel değerlerini koru.
                dedupedMap.set(key, {
                    ...previous,
                    ...row,
                    cari_firma_id: row.cari_firma_id || previous.cari_firma_id || "",
                    vkn: row.vkn || previous.vkn || "",
                    urun_id: row.urun_id || previous.urun_id || "",
                    proje_karti_id: row.proje_karti_id || previous.proje_karti_id || "",
                    hizmet_tipi: row.hizmet_tipi || previous.hizmet_tipi || "",
                    alt_hizmet_tipi: row.alt_hizmet_tipi || previous.alt_hizmet_tipi || "",
                    erp_proje_kodu: row.erp_proje_kodu || previous.erp_proje_kodu || "",
                    aktif: true,
                    updated_at: new Date().toISOString(),
                });
            });

            const uniqueImported = Array.from(dedupedMap.values());
            const duplicateCount = imported.length - uniqueImported.length;

            setCustomerImportStatus(
                duplicateCount > 0
                    ? `${imported.length} satır okundu · ${duplicateCount} tekrar birleştirildi · ${uniqueImported.length} kayıt hazırlanıyor...`
                    : `${uniqueImported.length} kayıt hazırlanıyor...`
            );
            setCustomerImportProgress(52);

            const chunkSize = 250;
            for (let i = 0; i < uniqueImported.length; i += chunkSize) {
                const chunk = uniqueImported.slice(i, i + chunkSize);
                const { error } = await supabase
                    .from(CUSTOMER_TABLE)
                    .upsert(chunk, { onConflict: "kayit_anahtari" });
                if (error) throw error;
                setCustomerImportProgress(Math.min(92, 52 + Math.round(((i + chunk.length) / uniqueImported.length) * 40)));
                setCustomerImportStatus(
                    `${Math.min(i + chunk.length, uniqueImported.length)} / ${uniqueImported.length} benzersiz kayıt Supabase'e aktarılıyor...`
                );
            }

            setCustomerImportProgress(100);
            setCustomerImportStatus("Müşteri listesi güncellendi.");
            await fetchCustomers();
            showMessage(
                "success",
                duplicateCount > 0
                    ? `${uniqueImported.length} kayıt işlendi. Excel'deki ${duplicateCount} tekrar otomatik birleştirildi.`
                    : `${uniqueImported.length} müşteri/proje kaydı işlendi.`
            );
            window.setTimeout(() => {
                setCustomerImporting(false);
                setCustomerImportProgress(0);
                setCustomerImportStatus("");
            }, 700);
        } catch (error) {
            setCustomerImporting(false);
            setCustomerImportProgress(0);
            setCustomerImportStatus("");
            showMessage("error", `Müşteri Excel'i aktarılamadı: ${error?.message || error}`);
        } finally {
            if (customerExcelRef.current) customerExcelRef.current.value = "";
        }
    };

    const filteredCustomers = useMemo(() => {
        const query = normalize(customerSearch).toLocaleLowerCase("tr-TR");
        if (!query) return customerRecords;
        return customerRecords.filter((record) =>
            [record.cari_firma_id, record.vkn, record.urun_id, record.proje_adi, record.proje_karti_id, record.firma_unvani, record.hizmet_tipi, record.alt_hizmet_tipi, record.erp_proje_kodu]
                .some((value) => normalize(value).toLocaleLowerCase("tr-TR").includes(query))
        );
    }, [customerRecords, customerSearch]);

    const filteredMappings = useMemo(() => {
        const query = normalize(mappingSearch).toLocaleLowerCase("tr-TR");
        if (!query) return mappings;

        return mappings.filter((item) =>
            MAPPING_COLUMNS.some(({ key }) =>
                normalize(item[key]).toLocaleLowerCase("tr-TR").includes(query)
            )
        );
    }, [mappings, mappingSearch]);

    const clearOrders = () => {
        if (!rows.length) return;

        const approved = window.confirm(
            `${rows.length} sipariş satırının tamamı temizlensin mi? Bu işlem yalnızca Sipariş Hazırla ekranını temizler; müşteri ve eşleştirme kayıtlarına dokunmaz.`
        );
        if (!approved) return;

        setRows([]);
        setFileName("");
        setRejectedSuggestionIds({});
        if (fileInputRef.current) fileInputRef.current.value = "";
        showMessage("success", "Sipariş hazırlama alanı temizlendi.");
    };

    const canPrepareOrders = customerProjects.length > 0 && !customersLoading;

    return (
        <div className="ys-page">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleFileChange}
                hidden
            />
            <input
                ref={mappingExcelRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={(event) => importMappingsFromExcel(event.target.files?.[0])}
                style={{ display: "none" }}
            />
            <input
                ref={customerExcelRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={(event) => importCustomersFromExcel(event.target.files?.[0])}
                hidden
            />

            <div className="ys-shell">
                <header className="ys-header">
                    <div>
                        <div className="ys-eyebrow">SİPARİŞ İŞLEMLERİ</div>
                        <h1>Yeni Sipariş</h1>
                        <p>Excel'i yükleyin. Sistem eşleştirmeleri otomatik uygulasın. Hazır Excel'i indirin.</p>
                    </div>

                    <div className="ys-tabs" role="tablist">
                        <button
                            type="button"
                            className={activeTab === "orders" ? "is-active" : ""}
                            onClick={() => setActiveTab("orders")}
                        >
                            <FileSpreadsheet size={16} /> Sipariş Hazırla
                        </button>
                        <button
                            type="button"
                            className={activeTab === "mapping" ? "is-active" : ""}
                            onClick={() => setActiveTab("mapping")}
                        >
                            Eşleştirme Tablosu
                            <span>{mappings.length}</span>
                        </button>
                        <button
                            type="button"
                            className={activeTab === "customers" ? "is-active" : ""}
                            onClick={() => setActiveTab("customers")}
                        >
                            <Users size={16} /> Müşteriler
                            <span>{customerRecords.length}</span>
                        </button>
                    </div>
                </header>

                {message && (
                    <div className={`ys-message ys-message--${message.type}`}>
                        {message.type === "success" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
                        <span>{message.text}</span>
                        <button type="button" onClick={() => setMessage(null)}><X size={15} /></button>
                    </div>
                )}

                {activeTab === "orders" ? (
                    <main className="ys-orders">
                        <section className="ys-customer-card">
                            <div className="ys-customer-step">
                                <span>1</span>
                                <div>
                                    <strong>Tek dosyada birden fazla müşteri ve proje hazırlayın</strong>
                                    <small>Sipariş şablonu yalnızca kullanıcı giriş alanlarını içerir. Müşteri, teslim noktası ve teknik ID eşleştirmelerini sistem otomatik tamamlar.</small>
                                </div>
                            </div>

                            <div className="ys-customer-fields">
                                <div className="ys-customer-status is-ready">
                                    <Users size={17} />
                                    <span>{customerRecords.length} aktif müşteri/proje kaydı otomatik eşleştirmeye hazır</span>
                                </div>
                                <div className="ys-customer-status is-ready">
                                    <CheckCircle2 size={17} />
                                    <span>VKN + Ürün ID + Proje Kartı/ERP Proje Kodu müşteri tablosundan otomatik gelir</span>
                                </div>
                            </div>
                        </section>

                        <section className="ys-action-card">
                            <div className="ys-action-copy">
                                <div className="ys-action-icon"><UploadCloud size={22} /></div>
                                <div>
                                    <strong>{fileName || "Sipariş Excel'inizi yükleyin"}</strong>
                                    <span>
                                        {fileName
                                            ? `${rows.length} satır okundu`
                                            : "Excel yüklendiğinde müşteri ve teslim/yükleme eşleştirmeleri otomatik uygulanır; eşleşmeyen değerler için sistem size en yakın adayı sorar."}
                                    </span>
                                </div>
                            </div>

                            <div className="ys-actions">
                                <button
                                    type="button"
                                    className="ys-btn ys-btn--ghost"
                                    onClick={downloadTemplate}
                                >
                                    <Download size={16} /> Şablon İndir
                                </button>
                                <button
                                    type="button"
                                    className="ys-btn ys-btn--primary"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={!canPrepareOrders}
                                >
                                    <UploadCloud size={16} /> Excel Yükle
                                </button>
                                <button
                                    type="button"
                                    className="ys-btn ys-btn--success"
                                    onClick={exportExcel}
                                    disabled={!preparedRows.length}
                                    title={!preparedRows.length ? "Excel'e aktarılacak sipariş bulunmuyor" : ""}
                                >
                                    <FileSpreadsheet size={16} /> Excel İndir
                                </button>
                                <button
                                    type="button"
                                    className="ys-btn ys-btn--danger"
                                    onClick={clearOrders}
                                    disabled={!rows.length}
                                    title={!rows.length ? "Temizlenecek sipariş bulunmuyor" : "Sipariş hazırlama alanındaki tüm satırları temizle"}
                                >
                                    <Trash2 size={16} /> Tümünü Temizle
                                </button>
                            </div>
                        </section>

                        {!rows.length ? (
                            <section
                                className={`ys-dropzone ${!canPrepareOrders ? "is-disabled" : ""}`}
                                onDragOver={(event) => canPrepareOrders && event.preventDefault()}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    if (canPrepareOrders) handleDrop(event);
                                }}
                                onClick={() => canPrepareOrders && fileInputRef.current?.click()}
                            >
                                <div className="ys-drop-icon"><FileSpreadsheet size={28} /></div>
                                <strong>{canPrepareOrders ? "Sipariş giriş Excel'ini buraya bırakın" : "Müşteri listesi yükleniyor"}</strong>
                                <span>{canPrepareOrders ? "Şablondaki sipariş alanlarını doldurup yükleyebilirsiniz" : "kısa süre içinde yükleme alanı aktif olur"}</span>
                                <small>.xlsx · .xls · .xlsm</small>
                            </section>
                        ) : (
                            <>
                                <section className="ys-summary">
                                    <div>
                                        <span>Toplam Sipariş</span>
                                        <strong>{preparedRows.length}</strong>
                                    </div>
                                    <div className="is-success">
                                        <span>Eşleşen</span>
                                        <strong>{readyCount}</strong>
                                    </div>
                                    <div className={waitingCount ? "is-warning" : "is-success"}>
                                        <span>Bekleyen</span>
                                        <strong>{waitingCount}</strong>
                                    </div>
                                    <div className="ys-summary-note">
                                        {waitingCount > 0 ? (
                                            <>
                                                <AlertCircle size={16} />
                                                <span>
                                                    Eşleşmeyen satırlar için aşağıdaki akıllı önerileri onaylayın. Aday bulunamazsa <button type="button" onClick={() => setActiveTab("mapping")}>Eşleştirme Tablosu</button> bölümünden kayıt ekleyebilirsiniz.
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={16} />
                                                <span>Tüm satırlar hazır. Excel'i indirebilirsiniz.</span>
                                            </>
                                        )}
                                    </div>
                                </section>

                                {mappingSuggestions.length > 0 && (
                                    <section className="ys-suggestion-panel">
                                        <div className="ys-suggestion-head">
                                            <div>
                                                <strong>Akıllı eşleştirme önerileri</strong>
                                                <span>Eşleşmeyen değerlerde kelime benzerliğine göre en yakın kayıtları buldum. Doğruysa onaylayın.</span>
                                            </div>
                                            <span className="ys-suggestion-count">{mappingSuggestions.length}</span>
                                        </div>
                                        <div className="ys-suggestion-list">
                                            {mappingSuggestions.map((suggestion) => (
                                                <div className="ys-suggestion-card" key={suggestion.key}>
                                                    <div className="ys-suggestion-copy">
                                                        <small>{suggestion.kind === "delivery" ? "Teslim noktası" : "Yükleme firması"}</small>
                                                        <strong>“{suggestion.source}”</strong>
                                                        <span>Bu mu: <b>{suggestion.item.musteriden_gelen || suggestion.item.teslim_noktasi_adi}</b></span>
                                                        <em>%{Math.round(suggestion.score * 100)} benzerlik</em>
                                                    </div>
                                                    <div className="ys-suggestion-ids">
                                                        {suggestion.kind === "delivery" ? (
                                                            <>
                                                                <span>Teslim Firma ID <b>{suggestion.item.teslim_firmasi_id || "—"}</b></span>
                                                                <span>Teslim Noktası ID <b>{suggestion.item.teslim_noktasi_id || "—"}</b></span>
                                                            </>
                                                        ) : (
                                                            <span>Yükleme Firma ID <b>{suggestion.item.teslim_firmasi_id || "—"}</b></span>
                                                        )}
                                                    </div>
                                                    <div className="ys-suggestion-actions">
                                                        <button type="button" className="ys-btn ys-btn--success ys-btn--compact" onClick={() => acceptMappingSuggestion(suggestion)}>
                                                            <Check size={14} /> Evet, bu
                                                        </button>
                                                        <button type="button" className="ys-btn ys-btn--ghost ys-btn--compact" onClick={() => rejectMappingSuggestion(suggestion)}>
                                                            <X size={14} /> Değil
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                <section className="ys-table-card">
                                    <div className="ys-table-toolbar">
                                        <div>
                                            <strong>Sipariş Önizleme</strong>
                                            <span>Excel İndir, bu tablonun aynısını dışarı aktarır</span>
                                        </div>

                                    </div>

                                    <div className="ys-table-wrap">
                                        <table className="ys-table ys-order-table">
                                            <thead>
                                                <tr>
                                                    {TEMPLATE_HEADERS.map((header) => <th key={header}>{header}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preparedRows.map((row) => (
                                                    <tr key={row.__index}>
                                                        {TEMPLATE_HEADERS.map((header) => {
                                                            const isCari = header === "Alıcı Firma Cari Adı";
                                                            const isAddress = header === "Teslim Firma Adres Adı";
                                                            const mappedValue = isCari
                                                                ? row.__mapping?.teslim_firmasi_id
                                                                : isAddress
                                                                    ? row.__mapping?.teslim_noktasi_id
                                                                    : "";
                                                            const editable = EDITABLE_ORDER_HEADERS.has(header);

                                                            return (
                                                                <td key={header}>
                                                                    {editable ? (
                                                                        header === "İstenilen Araç Tipi" ? (
                                                                            <select
                                                                                className="ys-inline-input"
                                                                                value={row[header] || ""}
                                                                                onChange={(event) => updateOrderRow(row.__index, { [header]: event.target.value })}
                                                                            >
                                                                                <option value="">Araç tipi seç</option>
                                                                                {VEHICLE_TYPE_OPTIONS.map((item) => (
                                                                                    <option key={item.code} value={item.code}>{item.label} ({item.code})</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : (
                                                                            <input
                                                                                className="ys-inline-input"
                                                                                value={row[header] || ""}
                                                                                onChange={(event) => updateOrderRow(row.__index, { [header]: event.target.value })}
                                                                                placeholder={header}
                                                                            />
                                                                        )
                                                                    ) : (
                                                                        <div className={`ys-cell-main ${["Vkn", "Proje", "Ürün"].includes(header) ? "ys-auto-value" : ""}`}>{row[header] || "—"}</div>
                                                                    )}
                                                                    {(isCari || isAddress) && mappedValue && (
                                                                        <div className="ys-mapped-value">→ {mappedValue}</div>
                                                                    )}
                                                                    {isAddress && !row.__ready && row.__incoming && (
                                                                        <div className="ys-unmapped-name">Müşteriden: {row.__incoming}</div>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </>
                        )}
                    </main>
                ) : activeTab === "mapping" ? (
                    <main className="ys-mapping-page">
                        <section className="ys-mapping-head">
                            <div>
                                <h2>Eşleştirme Tablosu</h2>
                                <p>Müşteriden gelen adları sistemdeki teslim firma ve teslim noktası ID'leriyle eşleştirin.</p>
                            </div>
                            <div className="ys-mapping-head-actions">
                                <button type="button" className="ys-btn ys-btn--ghost" onClick={downloadMappingTemplate}>
                                    <Download size={16} /> Örnek Şablon
                                </button>
                                <button type="button" className="ys-btn ys-btn--ghost" onClick={() => mappingExcelRef.current?.click()} disabled={mappingImporting}>
                                    {mappingImporting ? <LoaderCircle size={16} className="ys-spin" /> : <FileUp size={16} />} Excel ile Toplu Ekle
                                </button>
                                <button type="button" className="ys-btn ys-btn--primary" onClick={beginCreate} disabled={creating}>
                                    <Plus size={16} /> Manuel Ekle
                                </button>
                            </div>
                        </section>

                        {mappingImportStatus && (
                            <section className="ys-mapping-import-status">
                                <div><FileSpreadsheet size={17} /><span>{mappingImportStatus}</span><strong>{mappingImportProgress}%</strong></div>
                                <div className="ys-mapping-progress"><span style={{ width: `${mappingImportProgress}%` }} /></div>
                            </section>
                        )}

                        <section className="ys-table-card">
                            <div className="ys-mapping-toolbar">
                                <label className="ys-search">
                                    <Search size={16} />
                                    <input
                                        value={mappingSearch}
                                        onChange={(event) => setMappingSearch(event.target.value)}
                                        placeholder="Firma, müşteri adı, ID, il veya ilçe ara..."
                                    />
                                </label>
                                <span>{filteredMappings.length} / {mappings.length} kayıt</span>
                            </div>

                            <div className="ys-table-wrap">
                                <table className="ys-table ys-mapping-table">
                                    <thead>
                                        <tr>
                                            {MAPPING_COLUMNS.map((column) => <th key={column.key}>{column.label}</th>)}
                                            <th>İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {creating && (
                                            <tr className="ys-edit-row ys-new-row">
                                                {MAPPING_COLUMNS.map((column) => (
                                                    <td key={column.key}>
                                                        <input
                                                            className="ys-inline-input"
                                                            value={newValues[column.key]}
                                                            onChange={(event) =>
                                                                setNewValues((prev) => ({ ...prev, [column.key]: event.target.value }))
                                                            }
                                                            placeholder={column.label}
                                                        />
                                                    </td>
                                                ))}
                                                <td>
                                                    <div className="ys-row-actions">
                                                        <button type="button" className="ys-icon-btn is-save" onClick={saveNewMapping} disabled={saving} title="Kaydet">
                                                            <Check size={16} />
                                                        </button>
                                                        <button type="button" className="ys-icon-btn" onClick={() => setCreating(false)} disabled={saving} title="İptal">
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}

                                        {loadingMappings ? (
                                            <tr><td colSpan={MAPPING_COLUMNS.length + 1} className="ys-empty">Eşleştirme tablosu yükleniyor...</td></tr>
                                        ) : filteredMappings.length === 0 ? (
                                            <tr><td colSpan={MAPPING_COLUMNS.length + 1} className="ys-empty">Kayıt bulunamadı.</td></tr>
                                        ) : (
                                            filteredMappings.map((row) => {
                                                const isEditing = editingId === row.id;
                                                return (
                                                    <tr key={row.id} className={isEditing ? "ys-edit-row" : ""}>
                                                        {MAPPING_COLUMNS.map((column) => (
                                                            <td key={column.key}>
                                                                {isEditing ? (
                                                                    <input
                                                                        className="ys-inline-input"
                                                                        value={editValues[column.key]}
                                                                        onChange={(event) =>
                                                                            setEditValues((prev) => ({ ...prev, [column.key]: event.target.value }))
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <span className={column.key.includes("_id") ? "ys-id-value" : ""}>
                                                                        {row[column.key] || "—"}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        ))}
                                                        <td>
                                                            <div className="ys-row-actions">
                                                                {isEditing ? (
                                                                    <>
                                                                        <button type="button" className="ys-icon-btn is-save" onClick={saveEditMapping} disabled={saving} title="Kaydet">
                                                                            <Check size={16} />
                                                                        </button>
                                                                        <button type="button" className="ys-icon-btn" onClick={cancelEdit} disabled={saving} title="İptal">
                                                                            <X size={16} />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button type="button" className="ys-icon-btn" onClick={() => beginEdit(row)} title="Düzenle">
                                                                            <Pencil size={15} />
                                                                        </button>
                                                                        <button type="button" className="ys-icon-btn is-danger" onClick={() => archiveMapping(row)} disabled={mappingDeletingId === row.id} title="Sil">
                                                                            {mappingDeletingId === row.id ? <LoaderCircle size={15} className="ys-spin" /> : <Trash2 size={15} />}
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </main>
                ) : (
                    <main className="ys-customer-page">
                        <section className="ys-customer-workspace">
                        <div className="ys-customer-drawer-head">
                            <div className="ys-customer-drawer-title">
                                <span className="ys-customer-drawer-icon"><Building2 size={21} /></span>
                                <div>
                                    <small>MÜŞTERİ YÖNETİMİ</small>
                                    <h2>Müşteriler</h2>
                                    <p>Eşleştirme tablosunda olduğu gibi müşteri, proje ve ürün kayıtlarını ana çalışma alanında yönetin.</p>
                                </div>
                            </div>
                        </div>

                        <div className="ys-customer-stats">
                            <div><Users size={17} /><span>Toplam Kayıt<strong>{customerRecords.length}</strong></span></div>
                            <div><Building2 size={17} /><span>Firma<strong>{new Set(customerRecords.map((item) => normalizeKey(item.firma_unvani))).size}</strong></span></div>
                            <div><PackageOpen size={17} /><span>Ürünlü Kayıt<strong>{customerRecords.filter((item) => normalize(item.urun_id)).length}</strong></span></div>
                        </div>

                        <div className="ys-customer-toolbar">
                            <label className="ys-customer-search">
                                <Search size={16} />
                                <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Firma, proje, ürün veya VKN ara..." />
                                {customerSearch && <button type="button" onClick={() => setCustomerSearch("")}><X size={14} /></button>}
                            </label>
                            <div className="ys-customer-toolbar-actions">
                                <button className="ys-btn ys-btn--template" type="button" onClick={downloadCustomerTemplate} disabled={customerImporting} title="Doldurulabilir müşteri Excel şablonunu indir">
                                    <Download size={16} /> Örnek Şablon
                                </button>
                                <button className="ys-btn ys-btn--ghost" type="button" onClick={() => customerExcelRef.current?.click()} disabled={customerImporting}>
                                    <FileUp size={16} /> Excel ile Toplu Ekle
                                </button>
                                <button className="ys-btn ys-btn--primary" type="button" onClick={openCustomerCreate}>
                                    <Plus size={16} /> Manuel Ekle
                                </button>
                                <button className="ys-icon-btn ys-refresh-btn" type="button" onClick={fetchCustomers} title="Listeyi yenile">
                                    <RefreshCw size={16} className={customersLoading ? "ys-spin" : ""} />
                                </button>
                            </div>
                        </div>

                        {customerImporting && (
                            <div className="ys-customer-import-progress">
                                <div className="ys-import-progress-head">
                                    <span><LoaderCircle size={17} className="ys-spin" /> {customerImportStatus || "Excel işleniyor..."}</span>
                                    <strong>%{customerImportProgress}</strong>
                                </div>
                                <div className="ys-import-progress-track"><i style={{ width: `${customerImportProgress}%` }} /></div>
                            </div>
                        )}

                        {customerFormOpen && (
                            <div className="ys-customer-form-card">
                                <div className="ys-customer-form-head">
                                    <div>
                                        <small>{customerEditingId ? "KAYIT DÜZENLE" : "YENİ KAYIT"}</small>
                                        <strong>{customerEditingId ? "Müşteri bilgisini güncelle" : "Manuel müşteri ekle"}</strong>
                                    </div>
                                    <button type="button" onClick={() => setCustomerFormOpen(false)}><X size={16} /></button>
                                </div>
                                <div className="ys-customer-form-grid">
                                    <label><span>Cari Firma ID</span><input value={customerForm.cari_firma_id} onChange={(e) => setCustomerForm((prev) => ({ ...prev, cari_firma_id: e.target.value }))} placeholder="Cari firma ID" /></label>
                                    <label><span>VKN</span><input value={customerForm.vkn} onChange={(e) => setCustomerForm((prev) => ({ ...prev, vkn: e.target.value }))} placeholder="Vergi numarası" /></label>
                                    <label><span>Ürün ID</span><input value={customerForm.urun_id} onChange={(e) => setCustomerForm((prev) => ({ ...prev, urun_id: e.target.value }))} placeholder="Ürün ID" /></label>
                                    <label><span>Proje Adı</span><input value={customerForm.proje_adi} onChange={(e) => setCustomerForm((prev) => ({ ...prev, proje_adi: e.target.value }))} placeholder="Proje adı" /></label>
                                    <label><span>Proje Kartı ID</span><input value={customerForm.proje_karti_id} onChange={(e) => setCustomerForm((prev) => ({ ...prev, proje_karti_id: e.target.value }))} placeholder="Proje kartı ID" /></label>
                                    <label className="is-wide"><span>Firma Ünvanı *</span><input value={customerForm.firma_unvani} onChange={(e) => setCustomerForm((prev) => ({ ...prev, firma_unvani: e.target.value }))} placeholder="Örn. ABC Lojistik A.Ş." /></label>
                                    <label><span>Hizmet Tipi</span><input value={customerForm.hizmet_tipi} onChange={(e) => setCustomerForm((prev) => ({ ...prev, hizmet_tipi: e.target.value }))} placeholder="Hizmet tipi" /></label>
                                    <label><span>Alt Hizmet Tipi</span><input value={customerForm.alt_hizmet_tipi} onChange={(e) => setCustomerForm((prev) => ({ ...prev, alt_hizmet_tipi: e.target.value }))} placeholder="Alt hizmet tipi" /></label>
                                    <label><span>ERP Proje Kodu</span><input value={customerForm.erp_proje_kodu} onChange={(e) => setCustomerForm((prev) => ({ ...prev, erp_proje_kodu: e.target.value }))} placeholder="ERP proje kodu" /></label>
                                </div>
                                <div className="ys-customer-form-actions">
                                    <button className="ys-btn ys-btn--ghost" type="button" onClick={() => setCustomerFormOpen(false)} disabled={customerSaving}>Vazgeç</button>
                                    <button className="ys-btn ys-btn--primary" type="button" onClick={saveCustomer} disabled={customerSaving}>
                                        {customerSaving ? <LoaderCircle size={16} className="ys-spin" /> : <Save size={16} />}
                                        {customerEditingId ? "Değişiklikleri Kaydet" : "Müşteriyi Kaydet"}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="ys-customer-table-card">
                            <div className="ys-customer-table-head">
                                <div><strong>Müşteri Kayıtları</strong><span>{filteredCustomers.length} kayıt listeleniyor</span></div>
                                <small>Şablon: Cari Firma ID · VKN · Ürün ID · Proje Adı · Proje Kartı ID · Firma Ünvanı · Hizmet Tipi · Alt Hizmet Tipi · ERP Proje Kodu</small>
                            </div>
                            <div className="ys-customer-table-wrap">
                                <table className="ys-customer-table">
                                    <thead><tr><th>Cari Firma ID</th><th>VKN</th><th>Ürün ID</th><th>Proje Adı</th><th>Proje Kartı ID</th><th>Firma Ünvanı</th><th>Hizmet Tipi</th><th>Alt Hizmet Tipi</th><th>ERP Proje Kodu</th><th>İşlem</th></tr></thead>
                                    <tbody>
                                        {customersLoading ? (
                                            Array.from({ length: 5 }).map((_, index) => (
                                                <tr key={`skeleton-${index}`} className="ys-customer-skeleton"><td colSpan="10"><span /></td></tr>
                                            ))
                                        ) : filteredCustomers.length === 0 ? (
                                            <tr><td colSpan="10" className="ys-customer-empty"><Users size={26} /><strong>Kayıt bulunamadı</strong><span>Manuel ekleyin veya Excel ile toplu yükleyin.</span></td></tr>
                                        ) : filteredCustomers.map((record) => (
                                            <tr key={record.id}>
                                                <td><code>{record.cari_firma_id || "—"}</code></td>
                                                <td><code>{record.vkn || "—"}</code></td>
                                                <td><code>{record.urun_id || "—"}</code></td>
                                                <td>{record.proje_adi || <em>—</em>}</td>
                                                <td><code>{record.proje_karti_id || "—"}</code></td>
                                                <td><div className="ys-company-cell"><span>{normalize(record.firma_unvani).charAt(0) || "M"}</span><strong>{record.firma_unvani}</strong></div></td>
                                                <td>{record.hizmet_tipi || <em>—</em>}</td>
                                                <td>{record.alt_hizmet_tipi || <em>—</em>}</td>
                                                <td><code>{record.erp_proje_kodu || "—"}</code></td>
                                                <td><div className="ys-row-actions">
                                                    <button type="button" className="ys-icon-btn" onClick={() => openCustomerEdit(record)} title="Düzenle"><Pencil size={15} /></button>
                                                    <button type="button" className="ys-icon-btn is-danger" onClick={() => archiveCustomer(record)} disabled={customerDeletingId === record.id} title="Pasife al">
                                                        {customerDeletingId === record.id ? <LoaderCircle size={15} className="ys-spin" /> : <Trash2 size={15} />}
                                                    </button>
                                                </div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        </section>
                    </main>
                )}
            </div>
        </div>
    );
}
