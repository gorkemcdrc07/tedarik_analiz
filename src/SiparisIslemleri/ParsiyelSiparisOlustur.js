import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Plus,
    Trash2,
    Copy,
    Package2,
    Truck,
    FileText,
    RotateCcw,
    Moon,
    Sun,
    Search,
    ChevronDown,
    CalendarDays,
    Building2,
    FolderKanban,
    Hash,
    Layers,
    Zap,
} from "lucide-react";
import supabase from "../supabaseClient";
import { getTmsToken } from "./tmsService";

const emptyRow = () => ({
    plaka: "",
    vkn: "",
    musteriAdi: "",
    proje: "",
    siparisTarihi: "",
    yuklemeTarihi: "",
    teslimTarihi: "",
    musteriSiparisNo: "",
    musteriReferansNo: "",
    istenilenAracTipi: "",
});

const aracTipleri = [
    "ÇEKİCİ(AÇIK)",
    "ÇEKİCİ(KAPALI)",
    "KIRKAYAK",
    "ONTEKER",
];

const getVehicleTypeId = (aracTipi) => {
    switch (aracTipi) {
        case "ÇEKİCİ(AÇIK)": return 1;
        case "KIRKAYAK": return 2;
        case "ONTEKER": return 3;
        case "ÇEKİCİ(KAPALI)": return 21;
        default: return null;
    }
};

// Veri girişi sütunları ÖNCE, otomatik üretilen sütunlar SONDA
const columns = [
    { key: "plaka", label: "Plaka", type: "text", minWidth: 110, icon: Hash, group: "input" },

    { key: "musteriAdi", label: "Müşteri Adı", type: "customerSelect", minWidth: 200, icon: Building2, group: "input" },

    { key: "proje", label: "Proje Adı", type: "projectSelect", minWidth: 200, icon: FolderKanban, group: "input" },

    { key: "istenilenAracTipi", label: "Araç Tipi", type: "select", minWidth: 150, icon: Truck, group: "input", options: aracTipleri },

    { key: "siparisTarihi", label: "Sipariş Tarihi", type: "date", minWidth: 130, icon: CalendarDays, group: "input" },

    { key: "yuklemeTarihi", label: "Yükleme Tarihi", type: "date", minWidth: 130, icon: CalendarDays, group: "input" },

    { key: "teslimTarihi", label: "Teslim Tarihi", type: "date", minWidth: 130, icon: CalendarDays, group: "input" },

    { key: "musteriSiparisNo", label: "Müşteri Sipariş No", type: "text", minWidth: 170, icon: Hash, group: "auto", readOnly: true },

    { key: "musteriReferansNo", label: "Müşteri Referans No", type: "text", minWidth: 170, icon: Hash, group: "auto", readOnly: true },
];
function toNumber(value) {
    const n = parseFloat(String(value).replace(",", "."));
    return Number.isNaN(n) ? 0 : n;
}

function addDays(dateString, days) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
}

function getTodayNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
}

function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function isNumericWord(word) {
    return /^\d+$/.test(String(word || "").trim());
}

function getFirstMeaningfulWord(text) {
    const words = normalizeText(text).split(" ").filter(Boolean);
    const firstNonNumeric = words.find((word) => !isNumericWord(word));
    return firstNonNumeric || words[0] || "";
}

function buildCustomerOrderNo(customerName, count) {
    const firstWord = getFirstMeaningfulWord(customerName);
    const today = getTodayNumber();
    return `${firstWord}-${today}-${count}`;
}

function buildCustomerReferenceNo(customerName, plate, count) {
    const firstWord = getFirstMeaningfulWord(customerName);
    const cleanPlate = normalizeText(plate).replace(/\s+/g, "");
    return `${firstWord}-${cleanPlate}-${count}`;
}

/* ═══════════════════════ STYLES ═══════════════════════ */
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

*, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html, body, #root {
    min-height: 100%;
    font-family: 'Inter', system-ui, sans-serif;
    background: #070a12;
}

button, input, select, textarea {
    font: inherit;
}

.ps-dark {
    --bg: #070a12;
    --surface: #0d111c;
    --surface-2: #121827;
    --surface-3: #182033;
    --surface-hover: #202a42;

    --border: rgba(255,255,255,0.07);
    --border-md: rgba(255,255,255,0.11);
    --border-hi: rgba(255,255,255,0.18);

    --text-1: #f5f7fb;
    --text-2: #aab4c8;
    --text-3: #6f7a92;

    --accent: #4f8cff;
    --accent-dim: rgba(79,140,255,0.12);
    --accent-glow: rgba(79,140,255,0.26);

    --green: #22c55e;
    --green-dim: rgba(34,197,94,0.12);

    --red: #ef4444;
    --red-dim: rgba(239,68,68,0.12);

    --amber: #f59e0b;
    --amber-dim: rgba(245,158,11,0.12);

    --field-bg: #0f1524;
    --field-bg-hover: #151d30;
    --field-border: rgba(255,255,255,0.10);
    --field-text: #f5f7fb;
    --field-ph: #66728a;

    --shadow-sm: 0 6px 18px rgba(0,0,0,0.22);
    --shadow-md: 0 16px 48px rgba(0,0,0,0.32);
    --shadow-xl: 0 28px 90px rgba(0,0,0,0.62);

    --r-xs: 7px;
    --r-sm: 10px;
    --r-md: 14px;
    --r-lg: 18px;
    --r-xl: 22px;
    --r-2xl: 26px;

    --auto-col-bg: rgba(79,140,255,0.055);
    --auto-col-border: rgba(79,140,255,0.16);
}

/* ROOT */
.ps-root {
    min-height: 100vh;
    background:
        radial-gradient(circle at top left, rgba(79,140,255,0.13), transparent 34%),
        radial-gradient(circle at top right, rgba(34,197,94,0.08), transparent 30%),
        linear-gradient(180deg, #070a12 0%, #090d17 100%);
    color: var(--text-1);
    padding: 18px;
}

.ps-container {
    max-width: 1640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

/* HEADER */
.ps-header {
    background: rgba(13,17,28,0.92);
    border: 1px solid var(--border-md);
    border-radius: var(--r-2xl);
    padding: 18px;
    box-shadow: var(--shadow-md);
    position: relative;
    overflow: hidden;
}

.ps-header::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(79,140,255,0.13), transparent 42%);
    pointer-events: none;
}

.ps-header__row {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}

.ps-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--accent-dim);
    border: 1px solid var(--accent-glow);
    color: var(--accent);
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
    margin-bottom: 8px;
}

.ps-title {
    font-size: 23px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--text-1);
    line-height: 1.08;
}

.ps-subtitle {
    margin-top: 6px;
    color: var(--text-3);
    font-size: 12.5px;
    line-height: 1.6;
    max-width: 560px;
}

.ps-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

/* BUTTONS */
.ps-btn {
    height: 39px;
    border-radius: var(--r-md);
    padding: 0 15px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 700;
    white-space: nowrap;
    border: 1px solid transparent;
    transition: .15s ease;
}

.ps-btn:hover {
    transform: translateY(-1px);
}

.ps-btn--add {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 10px 24px var(--accent-glow);
}

.ps-btn--export {
    background: #17b982;
    color: #fff;
    box-shadow: 0 10px 24px rgba(23,185,130,0.20);
}

.ps-btn--ghost {
    background: var(--surface-3);
    color: var(--text-2);
    border-color: var(--border-md);
}

.ps-btn--ghost:hover {
    background: var(--surface-hover);
    color: var(--text-1);
}

/* kaldırıldı ama kalsın hata vermez */
.ps-theme-btn {
    display: none;
}

/* METRICS */
.ps-metrics {
    position: relative;
    display: grid;
    grid-template-columns: minmax(220px, 1.5fr) repeat(4, minmax(110px, .8fr));
    gap: 8px;
}

.ps-search {
    height: 43px;
    padding: 0 12px;
    border-radius: var(--r-md);
    border: 1px solid var(--field-border);
    background: var(--field-bg);
    color: var(--text-3);
    display: flex;
    align-items: center;
    gap: 9px;
    transition: .15s ease;
}

.ps-search:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-dim);
}

.ps-search input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--field-text);
    font-size: 12.5px;
}

.ps-search input::placeholder {
    color: var(--field-ph);
}

.ps-metric {
    height: 43px;
    border-radius: var(--r-md);
    border: 1px solid var(--border);
    background: var(--surface-2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 11px;
    gap: 8px;
}

.ps-metric__label {
    font-size: 8.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .12em;
    color: var(--text-3);
    white-space: nowrap;
}

.ps-metric__value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-1);
}

.ps-metric__icon {
    width: 27px;
    height: 27px;
    border-radius: var(--r-xs);
    background: var(--accent-dim);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
}

/* BANNER */
.ps-banner {
    margin-top: 10px;
    padding: 10px 13px;
    border-radius: var(--r-sm);
    background: var(--amber-dim);
    color: var(--amber);
    font-size: 12px;
    font-weight: 700;
    border: 1px solid rgba(245,158,11,0.18);
}

.ps-banner.is-error {
    background: var(--red-dim);
    color: var(--red);
    border-color: rgba(239,68,68,0.22);
}

/* TABLE CARD */
.ps-table-card {
    background: rgba(13,17,28,0.92);
    border: 1px solid var(--border-md);
    border-radius: var(--r-2xl);
    box-shadow: var(--shadow-md);
    overflow: hidden;
}

.ps-table-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    gap: 10px;
}

.ps-table-bar__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 800;
    color: var(--text-1);
}

.ps-table-bar__pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 7px;
    border-radius: 999px;
    background: var(--accent-dim);
    color: var(--accent);
    font-size: 11px;
    font-weight: 800;
    font-family: 'JetBrains Mono', monospace;
}

.ps-table-bar__meta {
    font-size: 11.5px;
    color: var(--text-3);
}

/* TABLE */
.ps-table-wrap {
    overflow-x: auto;
    overflow-y: visible;
    position: relative;
}

.ps-table-wrap::-webkit-scrollbar {
    height: 6px;
}

.ps-table-wrap::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.18);
    border-radius: 999px;
}

.ps-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
}

.ps-table thead th {
    background: #101727;
    color: var(--text-3);
    text-align: left;
    padding: 9px 8px;
    font-size: 8.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .12em;
    border-bottom: 1px solid var(--border-md);
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 10;
}

.ps-table thead th.col--auto {
    background: var(--auto-col-bg);
    border-left: 1px solid var(--auto-col-border);
}

.ps-th-inner {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.ps-th-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
}

.ps-col-group {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 7.5px;
    font-weight: 900;
    letter-spacing: .10em;
    text-transform: uppercase;
}

.ps-col-group--input {
    background: var(--green-dim);
    color: var(--green);
}

.ps-col-group--auto {
    background: var(--accent-dim);
    color: var(--accent);
}

.ps-table tbody td {
    padding: 6px 5px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
    overflow: visible;
}

.ps-table tbody td.col--auto {
    background: var(--auto-col-bg);
    border-left: 1px solid var(--auto-col-border);
}

.ps-table tbody tr {
    transition: background .12s ease;
}

.ps-table tbody tr:hover td {
    background: rgba(255,255,255,0.035);
}

.ps-table tbody tr:last-child td {
    border-bottom: none;
}

/* ROW INDEX */
.ps-row-idx {
    width: 28px;
    height: 28px;
    border-radius: var(--r-xs);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    color: var(--text-3);
    background: var(--surface-3);
    border: 1px solid var(--border);
    font-family: 'JetBrains Mono', monospace;
}

/* FIELDS */
.ps-field,
.ss-trigger {
    width: 100%;
    height: 33px;
    border-radius: var(--r-sm);
    border: 1px solid var(--field-border);
    background: var(--field-bg);
    color: var(--field-text);
    outline: none;
    padding: 0 9px;
    font-size: 12px;
    font-weight: 600;
    transition: .15s ease;
}

.ps-field::placeholder {
    color: var(--field-ph);
}

.ps-field:hover,
.ss-trigger:hover {
    border-color: var(--border-hi);
    background: var(--field-bg-hover);
}

.ps-field:focus,
.ss-trigger.is-open {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-dim);
}

.ps-field[readonly] {
    cursor: default;
    background: rgba(79,140,255,0.065);
    border-color: var(--auto-col-border);
    border-style: dashed;
    color: var(--accent);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
}

.ps-field--select {
    cursor: pointer;
}

/* SMART SELECT */
.ss-wrap {
    position: relative;
    width: 100%;
}

.ss-wrap.is-disabled {
    opacity: .42;
    pointer-events: none;
}

.ss-trigger {
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    text-align: left;
}

.ss-val {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
}

.ss-val.is-ph {
    color: var(--field-ph);
    font-weight: 500;
}

.ss-chevron {
    flex-shrink: 0;
    color: var(--text-3);
    transition: transform .18s ease;
}

.ss-chevron.rotated {
    transform: rotate(180deg);
}

.ss-dropdown {
    position: fixed;
    min-width: 280px;
    background: #111827;
    border: 1px solid var(--border-md);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-xl);
    z-index: 99999;
    overflow: hidden;
    animation: ssIn .14s ease;
}

@keyframes ssIn {
    from {
        opacity: 0;
        transform: translateY(-6px) scale(.985);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.ss-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 11px;
    border-bottom: 1px solid var(--border);
    color: var(--text-3);
}

.ss-search input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: var(--field-text);
    font-size: 12px;
    font-weight: 600;
}

.ss-menu {
    max-height: 220px;
    overflow-y: auto;
    padding: 5px;
}

.ss-option {
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text-1);
    text-align: left;
    padding: 8px 9px;
    border-radius: var(--r-sm);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: .12s ease;
}

.ss-option:hover {
    background: var(--accent-dim);
    color: var(--accent);
}

.ss-empty {
    padding: 14px 11px;
    color: var(--text-3);
    font-size: 12px;
    text-align: center;
}

/* ROW ACTIONS */
.ps-row-actions {
    display: flex;
    gap: 5px;
}

.ps-resizer {
    position: absolute;
    right: 0;
    top: 0;
    width: 8px;
    height: 100%;
    cursor: col-resize;
    user-select: none;
    z-index: 20;
}

.ps-resizer:hover {
    background: rgba(79,140,255,0.35);
}

.ps-table thead th {
    position: sticky;
}
.ps-icon-btn {
    width: 30px;
    height: 30px;
    border-radius: var(--r-sm);
    border: 1px solid var(--border);
    background: var(--surface-3);
    color: var(--text-3);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: .14s ease;
}

.ps-icon-btn:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}

.ps-icon-btn--copy:hover {
    background: var(--accent-dim);
    border-color: var(--accent-glow);
    color: var(--accent);
}

.ps-icon-btn--del:hover {
    background: var(--red-dim);
    border-color: rgba(239,68,68,.30);
    color: var(--red);
}

/* EMPTY */
.ps-empty {
    padding: 64px 20px;
    text-align: center;
    color: var(--text-3);
    font-size: 13px;
    font-weight: 600;
}

/* RESPONSIVE */
@media (max-width: 1300px) {
    .ps-metrics {
        grid-template-columns: 1.2fr 1fr 1fr;
    }

    .ps-metrics .ps-metric:nth-child(5),
    .ps-metrics .ps-metric:nth-child(4) {
        display: none;
    }
}

@media (max-width: 900px) {
    .ps-root {
        padding: 12px;
    }

    .ps-header {
        padding: 15px;
    }

    .ps-actions {
        width: 100%;
    }

    .ps-metrics {
        grid-template-columns: 1fr;
    }

    .ps-table-bar {
        align-items: flex-start;
        flex-direction: column;
    }
}
`;
/* ══════════════════════ SUB-COMPONENTS ══════════════════════ */
function SearchableSelect({ value, onSelect, options = [], placeholder = "Seçiniz", labelKey = "label", valueKey = "value", disabled = false, emptyMessage = "Sonuç bulunamadı" }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const wrapperRef = useRef(null);
    const [dropStyle, setDropStyle] = useState({});

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q) return options;
        return options.filter((item) => String(item[labelKey] || "").toLowerCase().includes(q));
    }, [options, query, labelKey]);

    useEffect(() => {
        const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleSelect = (item) => { onSelect(item); setQuery(""); setOpen(false); };

    return (
        <div className={`ss-wrap ${disabled ? "is-disabled" : ""}`} ref={wrapperRef}>
            <button type="button" className={`ss-trigger ${open ? "is-open" : ""}`} disabled={disabled}
                onClick={() => {
                    if (disabled) return;
                    const rect = wrapperRef.current?.getBoundingClientRect();
                    if (rect) setDropStyle({ top: rect.bottom + 5, left: rect.left, width: Math.max(rect.width, 300) });
                    setOpen((p) => !p);
                }}>
                <span className={`ss-val ${!value ? "is-ph" : ""}`}>{value || placeholder}</span>
                <ChevronDown size={15} className={`ss-chevron ${open ? "rotated" : ""}`} />
            </button>
            {open && !disabled && (
                <div className="ss-dropdown" style={dropStyle}>
                    <div className="ss-search">
                        <Search size={14} />
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ara..." autoFocus />
                    </div>
                    <div className="ss-menu">
                        {filtered.length > 0
                            ? filtered.map((item, idx) => (
                                <button key={`${item[valueKey]}-${idx}`} type="button" className="ss-option" onClick={() => handleSelect(item)} title={item[labelKey]}>
                                    {item[labelKey]}
                                </button>
                            ))
                            : <div className="ss-empty">{emptyMessage}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ════════════════════════ MAIN ════════════════════════ */
export default function ParsiyelSiparisOlustur() {
    const [rows, setRows] = useState([emptyRow()]);
    const [search, setSearch] = useState("");
    const [theme, setTheme] = useState("dark");
    const [projectOptions, setProjectOptions] = useState([]);
    const [customerOptions, setCustomerOptions] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [tmsToken, setTmsToken] = useState("");
    const [resultModal, setResultModal] = useState(null);
    // ✅ Sütun genişlik state
    const [columnWidths, setColumnWidths] = useState(
        Object.fromEntries(columns.map((c) => [c.key, c.minWidth]))
    );

    const startResizeColumn = (key, startX) => {
        const startWidth = columnWidths[key] || 120;

        const onMouseMove = (e) => {
            const diff = e.clientX - startX;

            setColumnWidths((prev) => ({
                ...prev,
                [key]: Math.max(90, startWidth + diff),
            }));
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };
    useEffect(() => {
        const fetchProjects = async () => {
            setLoadingProjects(true);
            setLoadError("");
            const { data, error } = await supabase
                .from("Proje_Tanitim_Karti")
                .select("ID, FirmaUnvani, ProjeAdi")
                .order("FirmaUnvani", { ascending: true })
                .order("ProjeAdi", { ascending: true });
            if (error) {
                setProjectOptions([]); setCustomerOptions([]);
                setLoadError("Müşteri ve proje listesi alınamadı.");
            } else {
                const fetched = data || [];
                setProjectOptions(fetched);
                const uniq = Array.from(new Map(fetched.filter((i) => i.FirmaUnvani).map((i) => [i.FirmaUnvani, { value: i.FirmaUnvani, label: i.FirmaUnvani }])).values());
                setCustomerOptions(uniq);
            }
            setLoadingProjects(false);
        };
        fetchProjects();
    }, []);

    useEffect(() => {
        let interval;
        const fetch = async () => {
            try { const t = await getTmsToken(); setTmsToken(t); } catch { }
        };
        fetch();
        interval = setInterval(fetch, 300000);
        return () => clearInterval(interval);
    }, []);

    const getProjectsByCustomer = (name) => {
        if (!name) return [];
        return projectOptions.filter((i) => i.FirmaUnvani === name).map((i) => ({ value: i.ProjeAdi, label: i.ProjeAdi, raw: i }));
    };

    const generateAutoNumbers = (list) => {
        const sc = {}, rc = {};
        return list.map((row) => {
            const cust = String(row.musteriAdi || "").trim();
            const plate = normalizeText(row.plaka).replace(/\s+/g, "");
            let musteriSiparisNo = "", musteriReferansNo = "";
            if (cust) {
                sc[cust] = (sc[cust] || 0) + 1;
                rc[cust] = (rc[cust] || 0) + 1;
                musteriSiparisNo = buildCustomerOrderNo(cust, sc[cust]);
                musteriReferansNo = plate ? buildCustomerReferenceNo(cust, plate, rc[cust]) : buildCustomerOrderNo(cust, rc[cust]);
            }
            return { ...row, musteriSiparisNo, musteriReferansNo };
        });
    };

    const updateRow = (index, key, value) => {
        setRows((prev) => {
            const updated = prev.map((row, i) => {
                if (i !== index) return row;
                if (key === "siparisTarihi") return { ...row, siparisTarihi: value, yuklemeTarihi: value, teslimTarihi: addDays(value, 1) };
                return { ...row, [key]: value };
            });
            return generateAutoNumbers(updated);
        });
    };

    const handleCustomerSelect = (index, customer) => {
        setRows((prev) => generateAutoNumbers(prev.map((row, i) => i === index ? { ...row, musteriAdi: customer?.value || "", proje: "", vkn: "" } : row)));
    };

    const handleProjectSelect = (index, projectItem) => {
        const project = projectItem?.raw;
        setRows((prev) => prev.map((row, i) => i === index ? { ...row, proje: project?.ProjeAdi || "", vkn: project?.ID != null ? String(project.ID) : "" } : row));
    };

    const addRow = () => setRows((prev) => generateAutoNumbers([...prev, emptyRow()]));
    const duplicateRow = (index) => setRows((prev) => { const next = [...prev]; next.splice(index + 1, 0, { ...prev[index] }); return generateAutoNumbers(next); });
    const removeRow = (index) => setRows((prev) => { if (prev.length === 1) return [emptyRow()]; return generateAutoNumbers(prev.filter((_, i) => i !== index)); });
    const resetTable = () => setRows([emptyRow()]);

    const filteredRows = useMemo(() => {
        if (!search.trim()) return rows;
        const q = search.toLowerCase();
        return rows.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)));
    }, [rows, search]);

    const handleSave = async () => {
        if (!tmsToken) {
            setResultModal({
                sent: [],
                skipped: [{ title: "Token alınamadı", reason: "Token henüz hazır değil." }]
            });
            return;
        }

        const sent = [];
        const skipped = [];

        for (const row of rows) {
            try {
                if (
                    !row.musteriAdi ||
                    !row.proje ||
                    !row.siparisTarihi ||
                    !row.yuklemeTarihi ||
                    !row.teslimTarihi
                ) {
                    skipped.push({
                        title: row.musteriSiparisNo || row.plaka || "Eksik satır",
                        reason: "Müşteri, proje veya tarih alanları eksik."
                    });
                    continue;
                }

                const body = {
                    referenceId: row.musteriSiparisNo,
                    version: 0,
                    projectId: 605,
                    vehicleTypeId: getVehicleTypeId(row.istenilenAracTipi) || 1,
                    orderDate: row.siparisTarihi,
                    pickupDate: row.yuklemeTarihi,
                    deliveryDate: row.teslimTarihi,
                    customerOrderNumber: row.musteriReferansNo,
                    lines: [{
                        pickupAddressId: 20607,
                        deliveryAddressReferenceId: "20607",
                        deliveryOrderNumber: "",
                        details: [{
                            productId: 173,
                            packingTypeId: 1,
                            quantity: 1,
                            length: 80,
                            width: 120,
                            height: 180,
                            weight: 1
                        }],
                        waybillNumbers: []
                    }]
                };
                const res = await fetch("http://localhost:5000/api/reel-api/tmsorders/add", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${tmsToken}`
                    },
                    body: JSON.stringify(body)
                });

                const text = await res.text();

                if (!res.ok) {
                    const isDuplicate =
                        text.toLowerCase().includes("duplicate") ||
                        text.toLowerCase().includes("already") ||
                        text.toLowerCase().includes("daha önce") ||
                        text.toLowerCase().includes("mevcut") ||
                        text.toLowerCase().includes("aynı");

                    skipped.push({
                        title: row.musteriSiparisNo || row.plaka || "Hatalı satır",
                        customer: row.musteriAdi,
                        plate: row.plaka,
                        isDuplicate,
                        reason: isDuplicate
                            ? `Bu sayaç ve müşteri daha önceden içeri atıldı`
                            : `TMS hata: ${res.status} - ${text}`
                    });

                    continue;
                }
                sent.push({
                    title: row.musteriSiparisNo,
                    plate: row.plaka,
                    customer: row.musteriAdi,
                    project: row.proje
                });

            } catch (err) {
                skipped.push({
                    title: row.musteriSiparisNo || row.plaka || "Hatalı satır",
                    reason: err.message
                });
            }
        }

        const sentRefs = new Set(sent.map((x) => x.title));

        setRows((prev) => {
            const remaining = prev.filter((row) => !sentRefs.has(row.musteriSiparisNo));
            return remaining.length > 0 ? generateAutoNumbers(remaining) : [emptyRow()];
        });

        setSearch("");

        setResultModal({ sent, skipped });
    };
    const inputCols = columns.filter((c) => c.group === "input");
    const autoCols = columns.filter((c) => c.group === "auto");
    const firstAutoKey = autoCols[0]?.key;

    return (
        <>
            <style>{styles}</style>
            <div className={`ps-root ${theme === "dark" ? "ps-dark" : "ps-light"}`}>
                {resultModal && (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.65)",
                        backdropFilter: "blur(8px)",
                        zIndex: 999999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 20
                    }}>
                        <div style={{
                            width: "min(760px, 100%)",
                            background: "var(--surface)",
                            border: "1px solid var(--border-md)",
                            borderRadius: "var(--r-2xl)",
                            boxShadow: "var(--shadow-xl)",
                            overflow: "hidden"
                        }}>
                            <div style={{
                                padding: 22,
                                borderBottom: "1px solid var(--border)",
                                background: "linear-gradient(135deg, var(--green-dim), transparent)"
                            }}>
                                <div style={{
                                    fontFamily: "'Syne', sans-serif",
                                    fontSize: 20,
                                    fontWeight: 800,
                                    color: "var(--text-1)"
                                }}>
                                    REEL Aktarım Sonucu
                                </div>
                                <div style={{
                                    marginTop: 6,
                                    color: "var(--text-3)",
                                    fontSize: 13
                                }}>
                                    Gönderilen ve atlanan siparişlerin özeti
                                </div>
                            </div>

                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 10,
                                padding: "16px 22px"
                            }}>
                                <div style={{
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--r-lg)",
                                    padding: 14,
                                    background: "var(--surface-2)"
                                }}>
                                    <strong style={{
                                        display: "block",
                                        fontSize: 26,
                                        color: "var(--green)",
                                        fontFamily: "'DM Mono', monospace"
                                    }}>
                                        {resultModal.sent.length}
                                    </strong>
                                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                                        Başarıyla gönderilen
                                    </span>
                                </div>

                                <div style={{
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--r-lg)",
                                    padding: 14,
                                    background: "var(--surface-2)"
                                }}>
                                    <strong style={{
                                        display: "block",
                                        fontSize: 26,
                                        color: "var(--red)",
                                        fontFamily: "'DM Mono', monospace"
                                    }}>
                                        {resultModal.skipped.length}
                                    </strong>
                                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                                        Atlanan / hatalı
                                    </span>
                                </div>
                            </div>

                            <div style={{
                                padding: "0 22px 18px",
                                maxHeight: 320,
                                overflowY: "auto"
                            }}>
                                {resultModal.sent.length > 0 && (
                                    <>
                                        <h4 style={{
                                            margin: "14px 0 8px",
                                            fontSize: 12,
                                            textTransform: "uppercase",
                                            letterSpacing: ".12em",
                                            color: "var(--text-3)"
                                        }}>
                                            Gönderilen Siparişler
                                        </h4>

                                        {resultModal.sent.map((item, index) => (
                                            <div key={`sent-${index}`} style={{
                                                padding: "10px 12px",
                                                borderRadius: "var(--r-md)",
                                                background: "var(--surface-2)",
                                                border: "1px solid rgba(34,197,94,.25)",
                                                marginBottom: 8,
                                                fontSize: 13,
                                                display: "flex",
                                                justifyContent: "space-between",
                                                gap: 12
                                            }}>
                                                <div>
                                                    <strong>{item.title}</strong><br />
                                                    <small style={{ color: "var(--text-3)" }}>
                                                        {item.customer} · {item.project}
                                                    </small>
                                                </div>
                                                <small style={{ color: "var(--text-3)" }}>
                                                    {item.plate}
                                                </small>
                                            </div>
                                        ))}
                                    </>
                                )}

                                {resultModal.skipped.length > 0 && (
                                    <>
                                        <h4 style={{
                                            margin: "14px 0 8px",
                                            fontSize: 12,
                                            textTransform: "uppercase",
                                            letterSpacing: ".12em",
                                            color: "var(--text-3)"
                                        }}>
                                            Atlanan Siparişler
                                        </h4>

                                        {resultModal.skipped.map((item, index) => (
                                            <div key={`skip-${index}`} style={{
                                                padding: "10px 12px",
                                                borderRadius: "var(--r-md)",
                                                background: "var(--surface-2)",
                                                border: "1px solid rgba(239,68,68,.25)",
                                                marginBottom: 8,
                                                fontSize: 13
                                            }}>
                                                {item.isDuplicate && (
                                                    <div style={{
                                                        margin: "8px 0",
                                                        padding: "8px 10px",
                                                        borderRadius: "var(--r-sm)",
                                                        background: "var(--amber-dim)",
                                                        color: "var(--amber)",
                                                        border: "1px solid rgba(245,158,11,.25)",
                                                        fontWeight: 700
                                                    }}>
                                                        ⚠ Bu sayaç ve müşteri daha önceden içeri atıldı
                                                    </div>
                                                )}
                                                <strong>{item.title}</strong><br />
                                                <small style={{ color: "var(--text-3)" }}>
                                                    {item.reason}
                                                </small>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            <div style={{
                                padding: "16px 22px 20px",
                                display: "flex",
                                justifyContent: "flex-end",
                                borderTop: "1px solid var(--border)"
                            }}>
                                <button
                                    onClick={() => setResultModal(null)}
                                    style={{
                                        height: 38,
                                        padding: "0 18px",
                                        borderRadius: "var(--r-md)",
                                        border: "none",
                                        background: "var(--accent)",
                                        color: "#fff",
                                        fontWeight: 700,
                                        cursor: "pointer"
                                    }}
                                >
                                    Tamam
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="ps-container">

                    {/* ── HEADER ── */}
                    <header className="ps-header">
                        <div className="ps-header__row">
                            <div>
                                <div className="ps-eyebrow"><Layers size={11} />Lojistik Sipariş Yönetimi</div>
                                <h1 className="ps-title">Sipariş Giriş Paneli</h1>
                                <p className="ps-subtitle">Yeni lojistik taleplerinizi hızlıca oluşturun, müşteri bazlı proje seçin ve sipariş akışını yönetin.</p>
                            </div>
                            <div className="ps-actions">
                                <button className="ps-btn ps-btn--add" onClick={addRow}><Plus size={16} />Yeni Satır</button>
                                <button className="ps-btn ps-btn--ghost" onClick={resetTable}><RotateCcw size={16} />Temizle</button>
                                <button className="ps-btn ps-btn--export" onClick={handleSave}><Zap size={16} />REEL'e Aktar</button>
                                <button className="ps-theme-btn" onClick={() => setTheme((t) => t === "dark" ? "light" : "dark")} title="Tema değiştir">
                                    {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="ps-metrics">
                            <div className="ps-search">
                                <Search size={16} />
                                <input type="text" placeholder="Tabloda ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
                            </div>
                            <div className="ps-metric">
                                <div><div className="ps-metric__label">Toplam Satır</div><div className="ps-metric__value">{rows.length}</div></div>
                                <div className="ps-metric__icon"><FileText size={15} /></div>
                            </div>
                            <div className="ps-metric">
                                <div><div className="ps-metric__label">Müşteri</div><div className="ps-metric__value">{new Set(rows.map(r => r.musteriAdi).filter(Boolean)).size}</div></div>
                                <div className="ps-metric__icon"><Building2 size={15} /></div>
                            </div>
                            <div className="ps-metric">
                                <div><div className="ps-metric__label">Proje</div><div className="ps-metric__value">{new Set(rows.map(r => r.proje).filter(Boolean)).size}</div></div>
                                <div className="ps-metric__icon"><FolderKanban size={15} /></div>
                            </div>
                            <div className="ps-metric">
                                <div><div className="ps-metric__label">Araç Tipi</div><div className="ps-metric__value">{new Set(rows.map(r => r.istenilenAracTipi).filter(Boolean)).size}</div></div>
                                <div className="ps-metric__icon"><Truck size={15} /></div>
                            </div>
                        </div>

                        {(loadingProjects || loadError) && (
                            <div className={`ps-banner ${loadError ? "is-error" : ""}`}>
                                {loadingProjects ? "⏳ Müşteri ve proje verileri yükleniyor..." : `⚠ ${loadError}`}
                            </div>
                        )}
                    </header>

                    {/* ── TABLE ── */}
                    <section className="ps-table-card">
                        <div className="ps-table-bar">
                            <div className="ps-table-bar__title">
                                <Layers size={15} />Sipariş Satırları
                                <span className="ps-table-bar__pill">{filteredRows.length}</span>
                            </div>
                            <div className="ps-table-bar__meta">
                                <span style={{ color: "var(--green)", fontWeight: 700, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>● GİRİŞ</span>
                                {" "}sütunları önde · {" "}
                                <span style={{ color: "var(--accent)", fontWeight: 700, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>▶ OTOMATİK</span>
                                {" "}sütunlar sonda
                            </div>
                        </div>

                        <div className="ps-table-wrap">
                            <table className="ps-table">
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: 62 }}>#</th>
                                        {columns.map((col) => {
                                            const Icon = col.icon;
                                            const isAuto = col.group === "auto";
                                            const isFirstAuto = col.key === firstAutoKey;
                                            return (
                                                <th
                                                    key={col.key}
                                                    style={{
                                                        width: columnWidths[col.key],
                                                        minWidth: columnWidths[col.key],
                                                        maxWidth: columnWidths[col.key],
                                                    }}
                                                    className={isAuto ? "col--auto" + (isFirstAuto ? " col--auto-first" : "") : ""}>
                                                    <div className="ps-th-inner">
                                                        <span className={`ps-col-group ps-col-group--${col.group}`}>
                                                            {isAuto ? "● OTOMATİK" : "✎ GİRİŞ"}
                                                        </span>
                                                        <span className="ps-th-label">
                                                            {Icon && <Icon size={13} />}<span>{col.label}</span>
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="ps-resizer"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            startResizeColumn(col.key, e.clientX);
                                                        }}
                                                    />
                                                </th>
                                            );
                                        })}
                                        <th style={{ minWidth: 92 }}>İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.length > 0 ? filteredRows.map((row) => {
                                        const actualIndex = rows.indexOf(row);
                                        const projOpts = getProjectsByCustomer(row.musteriAdi);
                                        return (
                                            <tr key={actualIndex}>
                                                <td><div className="ps-row-idx">{actualIndex + 1}</div></td>
                                                {columns.map((col) => {
                                                    const isAuto = col.group === "auto";
                                                    const isFirstAuto = col.key === firstAutoKey;
                                                    return (
                                                        <td key={col.key} className={isAuto ? "col--auto" + (isFirstAuto ? " col--auto-first" : "") : ""}>
                                                            {col.type === "select" ? (
                                                                <select value={row[col.key]} onChange={(e) => updateRow(actualIndex, col.key, e.target.value)} className="ps-field ps-field--select">
                                                                    <option value="">Seçiniz</option>
                                                                    {(col.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                                                                </select>
                                                            ) : col.type === "customerSelect" ? (
                                                                <SearchableSelect value={row[col.key]} options={customerOptions} onSelect={(c) => handleCustomerSelect(actualIndex, c)} placeholder="Müşteri seçiniz" labelKey="label" valueKey="value" emptyMessage="Müşteri bulunamadı" />
                                                            ) : col.type === "projectSelect" ? (
                                                                <SearchableSelect value={row[col.key]} options={projOpts} onSelect={(p) => handleProjectSelect(actualIndex, p)} placeholder={row.musteriAdi ? "Proje seçiniz" : "Önce müşteri seçiniz"} labelKey="label" valueKey="value" disabled={!row.musteriAdi} emptyMessage="Proje bulunamadı" />
                                                            ) : (
                                                                <input type={col.type === "date" ? "date" : "text"} value={row[col.key]} placeholder={col.label} readOnly={!!col.readOnly} onChange={(e) => updateRow(actualIndex, col.key, e.target.value)} className="ps-field" />
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td>
                                                    <div className="ps-row-actions">
                                                        <button className="ps-icon-btn ps-icon-btn--copy" onClick={() => duplicateRow(actualIndex)} title="Kopyala"><Copy size={14} /></button>
                                                        <button className="ps-icon-btn ps-icon-btn--del" onClick={() => removeRow(actualIndex)} title="Sil"><Trash2 size={14} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={columns.length + 2} className="ps-empty">Arama kriterine uygun kayıt bulunamadı.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}