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
    CheckCircle2,
    Send,
    LoaderCircle,
    Sparkles,
    ShieldCheck,
    Rows3,
    ArrowRight,
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

function normalizeSearch(value) {
    return String(value || "")
        .toLocaleLowerCase("tr-TR")
        .trim();
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

// ✅ Giriş yapan kullanıcının admin olup olmadığını localStorage'dan okur.
// Login.jsx içinde "loginUser" (obje, .rol alanı) ve "userRole" (string) olarak saklanıyor.
function getCurrentUserRole() {
    try {
        const loginUserRaw = localStorage.getItem("loginUser");
        if (loginUserRaw) {
            const parsed = JSON.parse(loginUserRaw);
            if (parsed?.rol) return String(parsed.rol).trim().toLowerCase();
        }
    } catch {
        // loginUser bozuksa userRole fallback'ine düş
    }
    const fallback = localStorage.getItem("userRole");
    return fallback ? String(fallback).trim().toLowerCase() : "";
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

    --accent: #e5252a;
    --accent-dim: rgba(229,37,42,0.12);
    --accent-glow: rgba(229,37,42,0.26);

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

    --auto-col-bg: rgba(229,37,42,0.055);
    --auto-col-border: rgba(229,37,42,0.16);
}

/* ROOT */
.ps-root {
    min-height: 100vh;
    background:
        radial-gradient(circle at top left, rgba(229,37,42,0.13), transparent 34%),
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
    background: linear-gradient(135deg, rgba(229,37,42,0.13), transparent 42%);
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

.ps-btn--admin {
    background: var(--violet, #7c5cf7);
    color: #fff;
    box-shadow: 0 10px 24px rgba(124,92,247,0.24);
}

.ps-btn:disabled {
    opacity: .55;
    cursor: not-allowed;
    transform: none !important;
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
    background: rgba(229,37,42,0.065);
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
    background: rgba(229,37,42,0.35);
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

/* FORM ROW (modallar için) */
.ps-form-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
}

.ps-form-row label {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--text-3);
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
/* OTS LIGHT THEME */
.ps-light {
    --bg: transparent;
    --surface: #ffffff;
    --surface-2: #f8fafc;
    --surface-3: #f1f5f9;
    --surface-hover: #f8fafc;
    --border: #e2e8f0;
    --border-md: #d8e1ec;
    --border-hi: #cbd5e1;
    --text-1: #14213d;
    --text-2: #475569;
    --text-3: #64748b;
    --accent: #e5252a;
    --accent-dim: #fff1f2;
    --accent-glow: #fecaca;
    --green: #16a34a;
    --green-dim: #f0fdf4;
    --red: #dc2626;
    --red-dim: #fef2f2;
    --amber: #d97706;
    --amber-dim: #fffbeb;
    --field-bg: #ffffff;
    --field-bg-hover: #f8fafc;
    --field-border: #d8e1ec;
    --field-text: #14213d;
    --field-ph: #94a3b8;
    --shadow-sm: 0 1px 2px rgba(15,23,42,.04);
    --shadow-md: 0 8px 24px rgba(15,23,42,.07);
    --shadow-xl: 0 24px 70px rgba(15,23,42,.18);
    --auto-col-bg: #f5f9ff;
    --auto-col-border: #ffe4e6;
}

html, body, #root { background: transparent; }
.ps-root { min-height:0; padding:0; background:transparent; }
.ps-container { max-width:1800px; gap:16px; }
.ps-header { background:rgba(255,255,255,.97); border-color:#e2e8f0; border-radius:16px; box-shadow:var(--shadow-sm); }
.ps-header::before { background:linear-gradient(135deg,rgba(229,37,42,.06),transparent 42%); }
.ps-eyebrow { color:#e5252a; background:#fff1f2; border-color:#fecaca; }
.ps-title { color:#14213d; }
.ps-subtitle { color:#64748b; }
.ps-theme-btn { display:none!important; }
.ps-btn { border-color:#d8e1ec; box-shadow:none; }
.ps-btn--ghost { color:#475569; background:#fff; }
.ps-btn--add,.ps-btn--export { background:#e5252a; border-color:#e5252a; color:#fff; box-shadow:0 5px 14px rgba(229,37,42,.17); }
.ps-btn--admin { color:#9a3412; background:#fff7ed; border-color:#fed7aa; }
.ps-search,.ps-metric,.ps-table-card { background:#fff; border-color:#e2e8f0; box-shadow:var(--shadow-sm); }
.ps-search input { color:#14213d; }
.ps-metric__label,.ps-table-bar__meta { color:#64748b; }
.ps-metric__value { color:#0f172a; }
.ps-table thead th { background:#f8fafc; color:#526174; border-color:#e2e8f0; }
.ps-table tbody td { color:#334155; background:#fff; border-color:#f1f5f9; }
.ps-table tbody tr:hover td { background:#f8fafc; }
.ps-table-wrap::-webkit-scrollbar-thumb { background:#cbd5e1; }
.ps-row-idx { color:#64748b; background:#f1f5f9; border-color:#e2e8f0; }
.ss-trigger { color:#14213d; background:#fff; border-color:#d8e1ec; }
.ss-trigger:hover,.ss-trigger.is-open { border-color:#e5252a; box-shadow:0 0 0 3px rgba(229,37,42,.10); }
.ss-dropdown { background:#fff; border-color:#e2e8f0; box-shadow:var(--shadow-xl); }
.ss-search { background:#f8fafc; border-color:#e2e8f0; }
.ss-search input { color:#14213d; }
.ss-option { color:#334155; }
.ss-option:hover { background:#fff1f2; color:#c9181e; }
.ps-field-input,.ps-field-select { color:#14213d; background:#fff; border-color:#d8e1ec; }
.ps-field-input:focus,.ps-field-select:focus { border-color:#e5252a; box-shadow:0 0 0 3px rgba(229,37,42,.10); }


/* ═══════════════════════ V7.3 PARSIYEL UX ═══════════════════════ */
.ps-header {
    isolation: isolate;
}

.ps-header::after {
    content: '';
    position: absolute;
    width: 240px;
    height: 240px;
    right: -90px;
    top: -130px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(229,37,42,.18), transparent 68%);
    pointer-events: none;
    z-index: -1;
}

.ps-actions--modern {
    padding: 5px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--surface-2) 88%, transparent);
    border: 1px solid var(--border);
}

.ps-btn--motion {
    position: relative;
    overflow: hidden;
    min-height: 42px;
    transition: transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s ease, background .2s ease, border-color .2s ease;
}

.ps-btn--motion::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 25%, rgba(255,255,255,.22) 48%, transparent 72%);
    transform: translateX(-130%);
    transition: transform .55s ease;
    pointer-events: none;
}

.ps-btn--motion:hover::after {
    transform: translateX(130%);
}

.ps-btn--motion:hover {
    transform: translateY(-2px);
}

.ps-btn--motion:active {
    transform: translateY(0) scale(.98);
}

.ps-btn__icon {
    width: 27px;
    height: 27px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,.12);
    flex: 0 0 auto;
}

.ps-btn--ghost .ps-btn__icon {
    background: var(--surface-hover);
}

.ps-btn__arrow {
    margin-left: 2px;
    transition: transform .2s ease;
}

.ps-btn--reel:hover .ps-btn__arrow {
    transform: translateX(3px);
}

.ps-spin {
    animation: psSpin .8s linear infinite;
}

@keyframes psSpin { to { transform: rotate(360deg); } }

.ps-flow {
    position: relative;
    margin-top: 12px;
    display: grid;
    grid-template-columns: minmax(220px, 1.25fr) minmax(430px, 2fr) minmax(150px, .65fr);
    gap: 12px;
    align-items: center;
    padding: 12px;
    border-radius: 16px;
    border: 1px solid var(--border-md);
    background: linear-gradient(135deg, var(--surface-2), color-mix(in srgb, var(--surface-3) 72%, transparent));
    overflow: hidden;
}

.ps-flow::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: linear-gradient(180deg, var(--accent), rgba(229,37,42,.15));
}

.ps-flow__intro {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.ps-flow__spark {
    width: 36px;
    height: 36px;
    border-radius: 11px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    background: var(--accent-dim);
    border: 1px solid var(--accent-glow);
    box-shadow: 0 0 24px rgba(229,37,42,.10);
}

.ps-flow__intro strong,
.ps-flow-step b {
    color: var(--text-1);
}

.ps-flow__intro strong {
    display: block;
    font-size: 12.5px;
    font-weight: 800;
}

.ps-flow__intro small,
.ps-flow-step small {
    display: block;
    margin-top: 3px;
    color: var(--text-3);
    font-size: 10.5px;
}

.ps-flow__steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
}

.ps-flow-step {
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 9px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--surface) 72%, transparent);
    transition: all .22s ease;
}

.ps-flow-step > span {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-3);
    color: var(--text-3);
}

.ps-flow-step.is-active {
    border-color: rgba(229,37,42,.26);
    background: var(--accent-dim);
}

.ps-flow-step.is-active > span,
.ps-flow-step.is-ready > span {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 6px 18px var(--accent-glow);
}

.ps-flow-step.is-done {
    border-color: rgba(34,197,94,.24);
    background: var(--green-dim);
}

.ps-flow-step.is-done > span {
    background: var(--green);
    color: #fff;
}

.ps-flow-step.is-processing {
    border-color: rgba(23,185,130,.3);
    box-shadow: inset 0 0 0 1px rgba(23,185,130,.08), 0 8px 24px rgba(23,185,130,.08);
}

.ps-readiness {
    min-width: 0;
}

.ps-readiness__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 7px;
    color: var(--text-3);
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .08em;
}

.ps-readiness__top strong {
    color: var(--text-1);
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
}

.ps-readiness__track {
    height: 7px;
    border-radius: 999px;
    background: var(--surface-3);
    overflow: hidden;
    border: 1px solid var(--border);
}

.ps-readiness__track i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--accent), #ff5a5f);
    box-shadow: 0 0 18px var(--accent-glow);
    transition: width .45s cubic-bezier(.2,.8,.2,1);
}

.ps-loading-inline {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.ps-table-card {
    transition: border-color .2s ease, box-shadow .2s ease;
}

.ps-table-card:hover {
    border-color: var(--border-hi);
    box-shadow: 0 18px 48px rgba(0,0,0,.22);
}

.ps-table-ready {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 7px;
    border-radius: 999px;
    background: var(--green-dim);
    color: var(--green);
    border: 1px solid rgba(34,197,94,.2);
    font-size: 9.5px;
    font-weight: 800;
}

.ps-row.is-new td {
    animation: psRowEnter .7s cubic-bezier(.2,.8,.2,1);
}

@keyframes psRowEnter {
    0% { background: rgba(229,37,42,.18); transform: translateY(-6px); opacity: .35; }
    55% { background: rgba(229,37,42,.07); }
    100% { background: transparent; transform: translateY(0); opacity: 1; }
}

.ps-row-actions {
    opacity: .76;
    transform: translateX(2px);
    transition: opacity .18s ease, transform .18s ease;
}

.ps-row:hover .ps-row-actions,
.ps-row:focus-within .ps-row-actions {
    opacity: 1;
    transform: translateX(0);
}

.ps-icon-btn {
    transition: transform .16s ease, background .16s ease, color .16s ease, box-shadow .16s ease;
}

.ps-icon-btn:hover {
    transform: translateY(-2px) scale(1.04);
}

.ps-icon-btn:active {
    transform: scale(.94);
}

.ps-field:focus,
.ss-trigger.is-open {
    box-shadow: 0 0 0 3px var(--accent-dim), 0 8px 20px rgba(0,0,0,.08);
}

/* Light theme keeps the same premium surfaces without losing contrast. */
.ps-light .ps-flow {
    background: linear-gradient(135deg, #ffffff, #f8fafc);
    box-shadow: 0 8px 26px rgba(15,23,42,.05);
}

.ps-light .ps-actions--modern {
    background: #f8fafc;
    border-color: #e2e8f0;
}

@media (max-width: 1180px) {
    .ps-flow { grid-template-columns: 1fr; }
    .ps-flow__steps { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
    .ps-flow__steps { grid-template-columns: 1fr; }
    .ps-actions--modern { width: 100%; }
    .ps-actions--modern .ps-btn { flex: 1 1 auto; justify-content: center; }
}

/* ═══════════════════════ V7.4 THEME + PREMIUM UX ═══════════════════════ */
.ps-theme-btn { display:none !important; }

.ps-root {
    background: transparent;
    padding: 0;
}

.ps-container {
    max-width: none;
    width: 100%;
    gap: 14px;
}

.ps-header {
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 18px 45px rgba(0,0,0,.14);
}

.ps-dark .ps-header {
    background:
        radial-gradient(circle at 86% -30%, rgba(229,37,42,.16), transparent 34%),
        linear-gradient(145deg, rgba(13,27,42,.98), rgba(8,22,35,.98));
    border-color: #20364a;
}

.ps-dark .ps-header::before {
    background: linear-gradient(110deg, rgba(229,37,42,.08), transparent 38%);
}

.ps-header__row {
    align-items: center;
    margin-bottom: 18px;
}

.ps-eyebrow {
    height: 26px;
    padding: 0 10px;
    margin-bottom: 9px;
}

.ps-title {
    font-size: clamp(24px, 2vw, 31px);
    letter-spacing: -.045em;
}

.ps-subtitle {
    font-size: 12.5px;
    max-width: 680px;
}

/* Tek parça, modern operasyon aksiyon barı */
.ps-actions--modern {
    gap: 7px;
    padding: 6px;
    border-radius: 14px;
    box-shadow: inset 0 1px rgba(255,255,255,.035);
}

.ps-dark .ps-actions--modern {
    background: rgba(5,15,26,.76);
    border-color: #20364a;
}

.ps-btn--motion {
    height: 42px;
    border-radius: 10px;
    padding: 0 13px 0 8px;
    box-shadow: none;
}

.ps-btn__icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
}

.ps-dark .ps-btn--admin,
.ps-dark .ps-btn--ghost {
    background: #102235;
    color: #dce8f2;
    border-color: #294158;
}

.ps-dark .ps-btn--admin:hover,
.ps-dark .ps-btn--ghost:hover {
    background: #142b42;
    border-color: #3a5872;
}

.ps-dark .ps-btn--add,
.ps-dark .ps-btn--export {
    background: linear-gradient(135deg,#f02d33,#d91e24);
    border-color: rgba(255,90,95,.55);
    color: #fff;
    box-shadow: 0 8px 22px rgba(229,37,42,.19);
}

.ps-dark .ps-btn--export:hover {
    box-shadow: 0 12px 30px rgba(229,37,42,.28);
}

/* KPI şeridi */
.ps-metrics {
    gap: 9px;
}

.ps-dark .ps-search,
.ps-dark .ps-metric {
    background: linear-gradient(180deg,#0d1b2a,#0a1724);
    border-color: #20364a;
    box-shadow: none;
}

.ps-dark .ps-search:focus-within {
    border-color: rgba(229,37,42,.62);
    box-shadow: 0 0 0 3px rgba(229,37,42,.10);
}

.ps-dark .ps-search input {
    color: #edf4fb;
}

.ps-dark .ps-metric__label { color:#7690a7; }
.ps-dark .ps-metric__value { color:#f4f8fb; }
.ps-dark .ps-metric__icon {
    background: rgba(229,37,42,.11);
    border: 1px solid rgba(229,37,42,.16);
}

/* Hazırlık panelini beyaz kart olmaktan çıkarıp operasyon rail yap */
.ps-flow {
    grid-template-columns: minmax(210px,.95fr) minmax(490px,2.25fr) minmax(150px,.7fr);
    min-height: 76px;
    padding: 10px 12px;
    border-radius: 14px;
    margin-top: 10px;
    box-shadow: none;
}

.ps-dark .ps-flow {
    background: linear-gradient(135deg,rgba(7,20,32,.94),rgba(11,29,45,.96));
    border-color: #20364a;
}

.ps-flow__spark {
    width: 38px;
    height: 38px;
    border-radius: 10px;
}

.ps-flow__steps { gap: 8px; }

.ps-flow-step {
    min-height: 54px;
    border-radius: 10px;
    padding: 8px 10px;
}

.ps-dark .ps-flow-step {
    background: #0d1b2a;
    border-color: #20364a;
}

.ps-dark .ps-flow-step > span {
    background: #10283d;
    color: #8ca4b8;
}

.ps-dark .ps-flow-step.is-active {
    background: linear-gradient(135deg,rgba(229,37,42,.16),rgba(229,37,42,.07));
    border-color: rgba(229,37,42,.42);
}

.ps-dark .ps-flow-step.is-done {
    background: linear-gradient(135deg,rgba(34,197,94,.13),rgba(34,197,94,.055));
    border-color: rgba(34,197,94,.28);
}

.ps-dark .ps-readiness__track {
    background: #06131f;
    border-color: #20364a;
    height: 8px;
}

/* Tablo başlığını tema ile aynı yüzeye al */
.ps-table-card {
    border-radius: 16px;
    box-shadow: none;
}

.ps-dark .ps-table-card {
    background: #0a1724;
    border-color: #20364a;
}

.ps-table-bar {
    min-height: 50px;
    padding: 10px 14px;
}

.ps-dark .ps-table-bar {
    background: linear-gradient(180deg,#0d1b2a,#0b1927);
    border-bottom-color: #20364a;
}

.ps-dark .ps-table-bar__title { color:#edf4fb; }
.ps-dark .ps-table-bar__meta { color:#7890a5; }
.ps-dark .ps-table-bar__pill {
    color:#ff6c71;
    background:rgba(229,37,42,.12);
    border:1px solid rgba(229,37,42,.18);
}

.ps-dark .ps-table thead th {
    background:#102235;
    color:#9fb4c6;
    border-bottom-color:#294158;
}

.ps-dark .ps-table thead th.col--auto {
    background:#12263a;
    border-left-color:rgba(229,37,42,.18);
}

.ps-dark .ps-table tbody td {
    background:#0a1724;
    color:#dce7f2;
    border-bottom-color:#183047;
}

.ps-dark .ps-table tbody td.col--auto {
    background:#0c1c2a;
    border-left-color:rgba(229,37,42,.14);
}

.ps-dark .ps-table tbody tr:hover td {
    background:#10243a;
}

.ps-dark .ps-table tbody tr:hover td.col--auto {
    background:#11283d;
}

/* Form alanları – modern ve okunur */
.ps-field,
.ss-trigger {
    height: 38px;
    border-radius: 9px;
    font-size: 11.5px;
    padding: 0 10px;
}

.ps-dark .ps-field,
.ps-dark .ss-trigger {
    background:#081724;
    color:#e8f0f7;
    border-color:#294158;
}

.ps-dark .ps-field:hover,
.ps-dark .ss-trigger:hover {
    background:#0d1f31;
    border-color:#3a5872;
}

.ps-dark .ps-field:focus,
.ps-dark .ss-trigger.is-open {
    background:#0d1f31;
    border-color:#ef3b40;
    box-shadow:0 0 0 3px rgba(229,37,42,.11),0 10px 24px rgba(0,0,0,.18);
}

.ps-dark .ps-field[readonly] {
    background:rgba(229,37,42,.06);
    color:#ff8c90;
    border-color:rgba(229,37,42,.24);
}

.ps-dark .ss-dropdown {
    background:#0d1b2a;
    border-color:#294158;
    box-shadow:0 24px 70px rgba(0,0,0,.42);
}

.ps-dark .ss-search {
    background:#081724;
    border-color:#20364a;
}

.ps-dark .ss-search input { color:#edf4fb; }
.ps-dark .ss-option { color:#dce7f2; }
.ps-dark .ss-option:hover { background:#132b42; color:#fff; }

.ps-row-idx {
    width:30px;
    height:30px;
    border-radius:8px;
}

.ps-dark .ps-row-idx {
    background:#102235;
    color:#a8bbcb;
    border-color:#294158;
}

.ps-icon-btn {
    width:34px;
    height:34px;
    border-radius:9px;
}

.ps-dark .ps-icon-btn--copy {
    background:#102235;
    color:#b9cada;
    border-color:#294158;
}

.ps-dark .ps-icon-btn--del {
    background:rgba(229,37,42,.08);
    color:#ff7378;
    border-color:rgba(229,37,42,.20);
}

.ps-dark .ps-icon-btn--copy:hover {
    background:#17314a;
    color:#fff;
}

.ps-dark .ps-icon-btn--del:hover {
    background:rgba(229,37,42,.17);
    color:#fff;
}

/* Yükleme / kaydetme esnasında üst panelde canlı progress çizgisi */
.ps-header:has(.ps-spin)::after {
    content:'';
    position:absolute;
    left:0;
    bottom:0;
    height:2px;
    width:36%;
    border-radius:999px;
    background:linear-gradient(90deg,transparent,#ff555a,#e5252a,transparent);
    box-shadow:0 0 18px rgba(229,37,42,.5);
    animation:psHeaderLoading 1.25s ease-in-out infinite;
}

@keyframes psHeaderLoading {
    0% { transform:translateX(-110%); opacity:.25; }
    40% { opacity:1; }
    100% { transform:translateX(310%); opacity:.2; }
}

/* Light tema da aynı yapısal tasarımı korusun */
.ps-light .ps-header,
.ps-light .ps-table-card {
    border-color:#dfe7ef;
    box-shadow:0 10px 30px rgba(15,23,42,.055);
}

.ps-light .ps-flow {
    border-color:#e1e8ef;
    background:linear-gradient(135deg,#fbfdff,#f6f9fc);
}

.ps-light .ps-table-bar { background:#fbfcfe; }
.ps-light .ps-actions--modern { background:#f7f9fc; }

@media (max-width: 1180px) {
    .ps-flow { grid-template-columns:1fr; }
}

@media (max-width: 900px) {
    .ps-header { padding:15px; }
    .ps-header__row { align-items:flex-start; }
    .ps-actions--modern { width:100%; }
    .ps-actions--modern .ps-btn { flex:1 1 calc(50% - 8px); justify-content:center; }
}

`;

/* ══════════════════════ SUB-COMPONENTS ══════════════════════ */
function SearchableSelect({ value, onSelect, options = [], placeholder = "Seçiniz", labelKey = "label", valueKey = "value", disabled = false, emptyMessage = "Sonuç bulunamadı" }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const wrapperRef = useRef(null);
    const [dropStyle, setDropStyle] = useState({});

    const filtered = useMemo(() => {
        const q = normalizeSearch(query);
        if (!q) return options;
        return options.filter((item) => normalizeSearch(item[labelKey]).includes(q));
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
    const [theme, setTheme] = useState(() => {
        const htmlTheme = document.documentElement.getAttribute("data-odak-theme");
        return htmlTheme || localStorage.getItem("odak-theme") || "light";
    });
    const [projectOptions, setProjectOptions] = useState([]);
    const [customerOptions, setCustomerOptions] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [tmsToken, setTmsToken] = useState("");
    const [resultModal, setResultModal] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0, label: "" });
    const [animatedRowIndex, setAnimatedRowIndex] = useState(null);

    // ✅ Rol bazlı görünürlük — sadece "admin" rolündeki kullanıcılar "Proje Ekle" butonunu görür
    const [isAdmin, setIsAdmin] = useState(false);

    // ✅ Proje Ekle modalı state'leri
    const [showAddProject, setShowAddProject] = useState(false);
    const [newProject, setNewProject] = useState({
        ID: "",
        FirmaUnvani: "",
        ProjeAdi: "",
    });
    const [addingProject, setAddingProject] = useState(false);
    const [addProjectError, setAddProjectError] = useState("");

    // ✅ Sütun genişlik state
    const [columnWidths, setColumnWidths] = useState(
        Object.fromEntries(columns.map((c) => [c.key, c.minWidth]))
    );

    useEffect(() => {
        setIsAdmin(getCurrentUserRole() === "admin");
    }, []);

    // Uygulamanın Navbar temasını birebir takip et. Parsiyel ekranın kendi
    // light/dark state'i global temadan kopmasın.
    useEffect(() => {
        const syncTheme = () => {
            const next = document.documentElement.getAttribute("data-odak-theme")
                || localStorage.getItem("odak-theme")
                || "light";
            setTheme(next === "dark" ? "dark" : "light");
        };

        syncTheme();
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-odak-theme"] });
        window.addEventListener("storage", syncTheme);

        return () => {
            observer.disconnect();
            window.removeEventListener("storage", syncTheme);
        };
    }, []);

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

    // ✅ Fonksiyona çıkarıldı: hem ilk yüklemede hem yeni proje eklendikten sonra tekrar çağrılabiliyor
    const fetchProjectsAndCustomers = async () => {
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

    useEffect(() => {
        fetchProjectsAndCustomers();
    }, []);

    useEffect(() => {
        let interval;
        const fetch = async () => {
            try {
                const t = await getTmsToken();
                setTmsToken(t);
            } catch (err) {
                console.error("TOKEN HATASI:", err);
            }
        };
        fetch();
        interval = setInterval(fetch, 300000);
        return () => clearInterval(interval);
    }, []);

    const getProjectsByCustomer = (name) => {
        if (!name) return [];
        return projectOptions.filter((i) => i.FirmaUnvani === name).map((i) => ({ value: i.ProjeAdi, label: i.ProjeAdi, raw: i }));
    };

    const getNextCustomerCounter = async (customerName) => {
        const today = getTodayNumber();

        const { data, error } = await supabase
            .from("siparis_sayaclari")
            .select("id, son_sayac")
            .eq("musteri_adi", customerName)
            .eq("tarih", today)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            const { data: inserted, error: insertError } = await supabase
                .from("siparis_sayaclari")
                .insert({
                    musteri_adi: customerName,
                    tarih: today,
                    son_sayac: 1,
                })
                .select("son_sayac")
                .single();

            if (insertError) throw insertError;

            return inserted.son_sayac;
        }

        const nextCounter = data.son_sayac + 1;

        const { error: updateError } = await supabase
            .from("siparis_sayaclari")
            .update({ son_sayac: nextCounter })
            .eq("id", data.id);

        if (updateError) throw updateError;

        return nextCounter;
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

    const pulseRow = (index) => {
        setAnimatedRowIndex(index);
        window.setTimeout(() => setAnimatedRowIndex((current) => current === index ? null : current), 850);
    };

    const addRow = () => {
        const nextIndex = rows.length;
        setRows((prev) => generateAutoNumbers([...prev, emptyRow()]));
        pulseRow(nextIndex);
    };

    const duplicateRow = (index) => {
        setRows((prev) => {
            const next = [...prev];
            next.splice(index + 1, 0, { ...prev[index] });
            return generateAutoNumbers(next);
        });
        pulseRow(index + 1);
    };

    const removeRow = (index) => setRows((prev) => {
        if (prev.length === 1) return [emptyRow()];
        return generateAutoNumbers(prev.filter((_, i) => i !== index));
    });

    const resetTable = () => {
        setRows([emptyRow()]);
        setSearch("");
        pulseRow(0);
    };

    // ✅ Yeni proje/firma kaydı ekleme (sadece admin butonundan tetiklenir)
    // ✅ Aynı ID varsa uyarı verir ve kayıt atmaz.
    const handleAddProject = async () => {
        const rawId = String(newProject.ID || "").trim();
        const id = Number(rawId);
        const firma = newProject.FirmaUnvani.trim();
        const proje = newProject.ProjeAdi.trim();

        if (!rawId || Number.isNaN(id) || id <= 0 || !firma || !proje) {
            setAddProjectError("Geçerli bir ID, firma unvanı ve proje adı zorunludur.");
            return;
        }

        setAddingProject(true);
        setAddProjectError("");

        try {
            // Önce mevcut kayıt kontrol edilir.
            const { data: existingProjects, error: checkError } = await supabase
                .from("Proje_Tanitim_Karti")
                .select("ID, FirmaUnvani, ProjeAdi")
                .eq("ID", id)
                .limit(1);

            if (checkError) {
                setAddProjectError(`ID kontrolü yapılamadı: ${checkError.message}`);
                return;
            }

            const existingProject = Array.isArray(existingProjects) ? existingProjects[0] : null;

            if (existingProject) {
                setAddProjectError(
                    `Bu ID zaten kayıtlı. ID: ${existingProject.ID} | Firma: ${existingProject.FirmaUnvani || "-"} | Proje: ${existingProject.ProjeAdi || "-"}`
                );
                return;
            }

            const { error } = await supabase
                .from("Proje_Tanitim_Karti")
                .insert({
                    ID: id,
                    FirmaUnvani: firma,
                    ProjeAdi: proje,
                });

            if (error) {
                // Veritabanında unique constraint varsa, eş zamanlı denemelerde de aynı ID engellenir.
                if (error.code === "23505") {
                    setAddProjectError("Bu ID zaten kayıtlı. Aynı ID ile ikinci kayıt oluşturulamaz.");
                    return;
                }

                setAddProjectError(`Proje eklenemedi: ${error.message}`);
                return;
            }

            await fetchProjectsAndCustomers();
            setNewProject({
                ID: "",
                FirmaUnvani: "",
                ProjeAdi: "",
            });
            setShowAddProject(false);
        } catch (err) {
            setAddProjectError(`Beklenmeyen hata oluştu: ${err?.message || err}`);
        } finally {
            setAddingProject(false);
        }
    };

    const filteredRows = useMemo(() => {
        if (!search.trim()) return rows;
        const q = normalizeSearch(search);
        return rows.filter((row) => Object.values(row).some((v) => normalizeSearch(v).includes(q)));
    }, [rows, search]);

    const readyRowCount = useMemo(() => rows.filter((row) =>
        row.musteriAdi && row.proje && row.siparisTarihi && row.yuklemeTarihi && row.teslimTarihi
    ).length, [rows]);

    const readiness = rows.length ? Math.round((readyRowCount / rows.length) * 100) : 0;

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

        setIsSaving(true);
        setSaveProgress({ current: 0, total: rows.length, label: "Siparişler hazırlanıyor" });

        for (const [rowIndex, row] of rows.entries()) {
            setSaveProgress({
                current: rowIndex + 1,
                total: rows.length,
                label: `${rowIndex + 1}. satır REEL için kontrol ediliyor`
            });
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

                const counter = await getNextCustomerCounter(row.musteriAdi);

                const musteriSiparisNo = buildCustomerOrderNo(row.musteriAdi, counter);

                const musteriReferansNo = row.plaka
                    ? buildCustomerReferenceNo(row.musteriAdi, row.plaka, counter)
                    : buildCustomerOrderNo(row.musteriAdi, counter);

                const body = {
                    referenceId: musteriSiparisNo,
                    version: 0,
                    projectId: 605,
                    vehicleTypeId: getVehicleTypeId(row.istenilenAracTipi) || 1,
                    orderDate: row.siparisTarihi,
                    pickupDate: row.yuklemeTarihi,
                    deliveryDate: row.teslimTarihi,
                    customerOrderNumber: musteriReferansNo,
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
                const res = await fetch(process.env.REACT_APP_TMS_ORDER_ADD_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${tmsToken}`,
                    },
                    body: JSON.stringify(body),
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
                    title: musteriSiparisNo,
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

        setSaveProgress({ current: rows.length, total: rows.length, label: "Aktarım tamamlandı" });
        setResultModal({ sent, skipped });
        window.setTimeout(() => {
            setIsSaving(false);
            setSaveProgress({ current: 0, total: 0, label: "" });
        }, 450);
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

                {/* ✅ PROJE EKLE MODALI — sadece admin bu modalı açabilir */}
                {showAddProject && (
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
                            width: "min(460px, 100%)",
                            background: "var(--surface)",
                            border: "1px solid var(--border-md)",
                            borderRadius: "var(--r-2xl)",
                            boxShadow: "var(--shadow-xl)",
                            overflow: "hidden"
                        }}>
                            <div style={{
                                padding: 22,
                                borderBottom: "1px solid var(--border)",
                                background: "linear-gradient(135deg, var(--accent-dim), transparent)"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 800, color: "var(--text-1)" }}>
                                    <FolderKanban size={18} />
                                    Yeni Proje / Firma Ekle
                                </div>
                                <div style={{ marginTop: 6, color: "var(--text-3)", fontSize: 12.5 }}>
                                    Sadece yöneticiler yeni firma ve proje kaydı oluşturabilir.
                                </div>
                            </div>

                            <div style={{ padding: "18px 22px" }}>
                                <div className="ps-form-row">
                                    <label>ID</label>
                                    <input
                                        type="number"
                                        className="ps-field"
                                        placeholder="Örn. 2068"
                                        value={newProject.ID}
                                        onChange={(e) =>
                                            setNewProject((p) => ({
                                                ...p,
                                                ID: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="ps-form-row">
                                    <label>Firma Unvanı</label>
                                    <input
                                        type="text"
                                        className="ps-field"
                                        placeholder="Örn. ACME LOJİSTİK A.Ş."
                                        value={newProject.FirmaUnvani}
                                        onChange={(e) => setNewProject((p) => ({ ...p, FirmaUnvani: e.target.value }))}
                                    />
                                </div>
                                <div className="ps-form-row" style={{ marginBottom: 4 }}>
                                    <label>Proje Adı</label>
                                    <input
                                        type="text"
                                        className="ps-field"
                                        placeholder="Örn. İSTANBUL DEPO PROJESİ"
                                        value={newProject.ProjeAdi}
                                        onChange={(e) => setNewProject((p) => ({ ...p, ProjeAdi: e.target.value }))}
                                    />
                                </div>

                                {addProjectError && (
                                    <div className="ps-banner is-error" style={{ marginTop: 12 }}>
                                        ⚠ {addProjectError}
                                    </div>
                                )}
                            </div>

                            <div style={{
                                padding: "0 22px 20px",
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 8
                            }}>
                                <button
                                    className="ps-btn ps-btn--ghost"
                                    onClick={() => {
                                        setShowAddProject(false);
                                        setAddProjectError("");
                                        setNewProject({ ID: "", FirmaUnvani: "", ProjeAdi: "" });
                                    }}
                                    disabled={addingProject}
                                >
                                    İptal
                                </button>
                                <button
                                    className="ps-btn ps-btn--add"
                                    onClick={handleAddProject}
                                    disabled={addingProject}
                                >
                                    {addingProject ? "Kaydediliyor..." : "Kaydet"}
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
                            <div className="ps-actions ps-actions--modern">
                                {isAdmin && (
                                    <button className="ps-btn ps-btn--admin ps-btn--motion" onClick={() => setShowAddProject(true)}>
                                        <span className="ps-btn__icon"><FolderKanban size={16} /></span>
                                        <span>Proje Ekle</span>
                                    </button>
                                )}
                                <button className="ps-btn ps-btn--add ps-btn--motion" onClick={addRow}>
                                    <span className="ps-btn__icon"><Plus size={16} /></span>
                                    <span>Yeni Satır</span>
                                </button>
                                <button className="ps-btn ps-btn--ghost ps-btn--motion" onClick={resetTable} disabled={isSaving}>
                                    <span className="ps-btn__icon"><RotateCcw size={16} /></span>
                                    <span>Temizle</span>
                                </button>
                                <button className="ps-btn ps-btn--export ps-btn--motion ps-btn--reel" onClick={handleSave} disabled={isSaving}>
                                    <span className="ps-btn__icon">{isSaving ? <LoaderCircle size={16} className="ps-spin" /> : <Send size={16} />}</span>
                                    <span>{isSaving ? `Aktarılıyor ${saveProgress.current}/${saveProgress.total}` : "REEL'e Aktar"}</span>
                                    {!isSaving && <ArrowRight size={14} className="ps-btn__arrow" />}
                                </button>
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

                        <div className="ps-flow">
                            <div className="ps-flow__intro">
                                <span className="ps-flow__spark"><Sparkles size={15} /></span>
                                <div>
                                    <strong>Sipariş hazırlık durumu</strong>
                                    <small>Satırları tamamlayın, kontrol edin ve REEL'e aktarın.</small>
                                </div>
                            </div>
                            <div className="ps-flow__steps">
                                <div className={`ps-flow-step ${rows.length ? "is-active" : ""}`}>
                                    <span><Rows3 size={14} /></span>
                                    <div><b>1. Satırlar</b><small>{rows.length} kayıt</small></div>
                                </div>
                                <div className={`ps-flow-step ${readyRowCount === rows.length && rows.length ? "is-done" : readyRowCount ? "is-active" : ""}`}>
                                    <span>{readyRowCount === rows.length && rows.length ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}</span>
                                    <div><b>2. Kontrol</b><small>{readyRowCount}/{rows.length} hazır</small></div>
                                </div>
                                <div className={`ps-flow-step ${isSaving ? "is-processing" : readiness === 100 ? "is-ready" : ""}`}>
                                    <span>{isSaving ? <LoaderCircle size={14} className="ps-spin" /> : <Send size={14} />}</span>
                                    <div><b>3. REEL</b><small>{isSaving ? "Aktarılıyor" : readiness === 100 ? "Aktarıma hazır" : "Hazırlanıyor"}</small></div>
                                </div>
                            </div>
                            <div className="ps-readiness" aria-label={`Hazırlık yüzde ${readiness}`}>
                                <div className="ps-readiness__top"><span>Hazırlık</span><strong>%{readiness}</strong></div>
                                <div className="ps-readiness__track"><i style={{ width: `${readiness}%` }} /></div>
                            </div>
                        </div>

                        {(loadingProjects || loadError) && (
                            <div className={`ps-banner ${loadError ? "is-error" : ""}`}>
                                {loadingProjects ? (
                                    <span className="ps-loading-inline"><LoaderCircle size={15} className="ps-spin" /> Müşteri ve proje verileri hazırlanıyor...</span>
                                ) : `⚠ ${loadError}`}
                            </div>
                        )}
                    </header>

                    {/* ── TABLE ── */}
                    <section className="ps-table-card">
                        <div className="ps-table-bar">
                            <div className="ps-table-bar__title">
                                <Layers size={15} />Sipariş Satırları
                                <span className="ps-table-bar__pill">{filteredRows.length}</span>
                                {readyRowCount === rows.length && rows.length > 0 && <span className="ps-table-ready"><CheckCircle2 size={12} /> Hazır</span>}
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
                                            <tr key={actualIndex} className={animatedRowIndex === actualIndex ? "ps-row is-new" : "ps-row"}>
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
                                                        <button className="ps-icon-btn ps-icon-btn--copy" onClick={() => duplicateRow(actualIndex)} title="Satırı kopyala" aria-label="Satırı kopyala"><Copy size={14} /></button>
                                                        <button className="ps-icon-btn ps-icon-btn--del" onClick={() => removeRow(actualIndex)} title="Satırı sil" aria-label="Satırı sil"><Trash2 size={14} /></button>
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