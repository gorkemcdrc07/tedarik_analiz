// src/AnaSayfa.js
import React, { useEffect, useMemo, useRef, useState } from "react";

/** ENV
 * REACT_APP_API_BASE_URL=https://...
 * REACT_APP_ODAK_API_KEY=...
 */
const API_BASE = process.env.REACT_APP_API_BASE_URL || "";
const ODAK_KEY = process.env.REACT_APP_ODAK_API_KEY || "";

/* ============== Küçük UI yardımcıları (paketsiz) ============== */
const GlowCard = ({ children, className = "" }) => (
    <div className={`p-[1px] rounded-2xl bg-gradient-to-br from-white/15 via-white/5 to-transparent ${className}`}>
        <div className="rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur">
            {children}
        </div>
    </div>
);

const Card = ({ children, className = "" }) => (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = "" }) => <div className={`px-5 pt-4 ${className}`}>{children}</div>;
const CardTitle = ({ children, className = "" }) => <h3 className={`text-base font-semibold ${className}`}>{children}</h3>;
const CardDescription = ({ children, className = "" }) => (
    <p className={`text-sm text-gray-400 mt-1 ${className}`}>{children}</p>
);
const CardContent = ({ children, className = "" }) => <div className={`p-5 ${className}`}>{children}</div>;
const Badge = ({ children, className = "" }) => (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${className}`}>{children}</span>
);
const Button = ({ children, className = "", variant = "solid", ...props }) => (
    <button
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition ${variant === "outline"
                ? "border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
                : variant === "ghost"
                    ? "text-gray-300 hover:text-white hover:bg-white/5"
                    : "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg hover:shadow-indigo-500/25"
            } ${className}`}
        {...props}
    >
        {children}
    </button>
);

const LiveDot = ({ ok = true }) => (
    <span className="relative inline-flex items-center">
        <span className={`absolute -left-3 ${ok ? "animate-ping" : ""} inline-flex h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"} opacity-75`}></span>
        <span className={`-ml-3 inline-flex h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`}></span>
    </span>
);

const UyumBar = ({ value = 0 }) => {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    const color = pct < 70 ? "bg-rose-500" : pct < 90 ? "bg-amber-500" : "bg-emerald-500";
    return (
        <div className="flex items-center gap-2">
            <div className="h-2 w-28 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-2 ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold">%{pct}</span>
        </div>
    );
};

const ToggleChip = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`rounded-full px-3 py-1 text-xs border transition ${active ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-200" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            }`}
    >
        {children}
    </button>
);

const Modal = ({ open, onClose, title, children }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-gray-900/90" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button onClick={onClose} className="rounded-lg px-2 py-1 bg-white/10 hover:bg-white/20">✕</button>
                </div>
                <div className="p-5 max-h-[70vh] overflow-auto">{children}</div>
            </div>
        </div>
    );
};

/* ============== Domain sabitleri ============== */
const ALLOWED_PROJECTS = new Set([
    "BUNGE LÜLEBURGAZ FTL", "BUNGE GEBZE FTL", "BUNGE PALET", "REKA FTL", "EKSUN GIDA FTL", "SARUHAN FTL",
    "PEPSİ FTL", "MUTLU MAKARNA SPOT FTL", "TEKİRDAĞ UN FTL", "AYDINLI MODA FTL", "ADKOTURK FTL",
    "ADKOTURK FTL ENERJİ İÇECEĞİ", "SGS FTL", "BSH FTL", "ALTERNA GIDA FTL", "DERYA OFİS FTL",
    "SAPRO FTL", "MARMARA CAM FTL", "FAKİR FTL", "MODERN KARTON FTL", "KÜÇÜKBAY FTL",
]);

const normalizeProjectName = (name) => {
    const map = {
        "BUNGE DİLOVASI-REYSAŞ": "BUNGE GEBZE FTL",
        "BUNGE PALET": "BUNGE PALET",
        "BUNGE LÜLEBURGAZ FTL": "BUNGE LÜLEBURGAZ FTL",
    };
    return map[name] || name;
};
const addDays = (dateStr, delta) => {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
};

/* ============== ODAK API ============== */
async function fetchOdakDataForRange(startStr, endStr) {
    if (!API_BASE || !ODAK_KEY) throw new Error("ODAK API env eksik (REACT_APP_API_BASE_URL / REACT_APP_ODAK_API_KEY).");

    const wideStart = addDays(startStr, -2);
    const wideEnd = addDays(endStr, 2);

    const payload = { startDate: `${wideStart}T00:00:00`, endDate: `${wideEnd}T23:59:59`, userId: 1 };

    const res = await fetch(`${API_BASE}/odak`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: ODAK_KEY },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`ODAK API ${res.status} — ${txt || res.statusText}`);
    }

    const result = await res.json();
    const items = Array.isArray(result.Data) ? result.Data : [];

    const filtered = items.filter((item) => {
        const pickupDate = item.PickupDate?.split("T")[0];
        const req = item.TMSVehicleRequestDocumentNo;
        return (
            pickupDate && pickupDate >= startStr && pickupDate <= endStr &&
            item.OrderStatu !== 200 && req && !req.startsWith("BOS") && item.ProjectName
        );
    });

    const projectMap = new Map();
    for (const item of filtered) {
        const project = normalizeProjectName(item.ProjectName?.trim() || "");
        const reqNo = item.TMSVehicleRequestDocumentNo;
        const hasDespatch = item.TMSDespatchDocumentNo && !item.TMSDespatchDocumentNo.startsWith("BOS");
        const vehicleWorking = (item?.VehicleWorkingName || "").toUpperCase();

        if (!projectMap.has(project)) {
            projectMap.set(project, {
                ProjectName: project,
                talepSet: new Set(),
                tedarikSet: new Set(),
                spotSet: new Set(),
                filoSet: new Set(),
                records: [], // detay listesi için
            });
        }
        const proj = projectMap.get(project);
        proj.talepSet.add(reqNo);
        if (hasDespatch) proj.tedarikSet.add(reqNo);
        if (vehicleWorking.includes("SPOT")) proj.spotSet.add(reqNo);
        else if (vehicleWorking.includes("FİLO") || vehicleWorking.includes("FILO")) proj.filoSet.add(reqNo);
        // Detayda göstereceğimiz hafif kayıt
        proj.records.push({
            ProjectName: item.ProjectName,
            PickupDate: item.PickupDate,
            VehicleWorkingName: item.VehicleWorkingName,
            TMSVehicleRequestDocumentNo: item.TMSVehicleRequestDocumentNo,
            TMSDespatchDocumentNo: item.TMSDespatchDocumentNo,
            FromCityName: item.FromCityName,
            ToCityName: item.ToCityName,
            OrderStatu: item.OrderStatu,
        });
    }

    const rows = Array.from(projectMap.values())
        .map((p) => ({
            ProjectName: p.ProjectName,
            Talep: p.talepSet.size,
            Tedarik: p.tedarikSet.size,
            Verilemeyen: p.talepSet.size - p.tedarikSet.size,
            Spot: p.spotSet.size,
            Filo: p.filoSet.size,
            records: p.records,
        }))
        .filter((p) => ALLOWED_PROJECTS.has(p.ProjectName));

    return rows;
}

/* ============== Sayfa ============== */
const AnaSayfa = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);

    // yenileme ayarları
    const DEFAULT_REFRESH_MS = 120000; // 2 dk
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshMs, setRefreshMs] = useState(DEFAULT_REFRESH_MS);

    const [loading, setLoading] = useState(true);       // sadece ilk yükte skeleton
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState([]);
    const [lastUpdated, setLastUpdated] = useState(null);

    // UI extras
    const [dense, setDense] = useState(false);
    const [q, setQ] = useState("");
    const [onlyLow, setOnlyLow] = useState(false);      // uyum < 70
    const [onlyPending, setOnlyPending] = useState(false); // verilemeyen > 0

    // sıralama
    const [sortKey, setSortKey] = useState("ProjectName"); // "Talep", "Tedarik", ...
    const [sortDir, setSortDir] = useState("desc");        // "asc" | "desc"

    // detay modal
    const [modalOpen, setModalOpen] = useState(false);
    const [modalProject, setModalProject] = useState(null);

    const busyRef = useRef(false); // eşzamanlı istekleri engelle

    const handleLoad = async ({ initial = false } = {}) => {
        if (busyRef.current) return;
        busyRef.current = true;
        setError(null);
        initial ? setLoading(true) : setRefreshing(true);

        try {
            const data = await fetchOdakDataForRange(startDate, endDate);
            setRows((prev) => {
                const prevSig = JSON.stringify(prev);
                const nextSig = JSON.stringify(data);
                if (prevSig === nextSig) return prev;
                return data;
            });
            setLastUpdated(new Date());
        } catch (e) {
            setError(e.message || "ODAK verisi alınamadı");
            setRows([]);
        } finally {
            initial ? setLoading(false) : setRefreshing(false);
            busyRef.current = false;
        }
    };

    // ilk yük
    useEffect(() => {
        handleLoad({ initial: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate]);

    // otomatik yenileme (görünürken)
    useEffect(() => {
        if (!autoRefresh) return;
        const tick = () => { if (!document.hidden) handleLoad(); };
        const id = setInterval(tick, refreshMs);
        return () => clearInterval(id);
    }, [autoRefresh, refreshMs, startDate, endDate]);

    // odağa dönünce tazele
    useEffect(() => {
        const onFocus = () => { if (!document.hidden && autoRefresh) handleLoad(); };
        window.addEventListener("visibilitychange", onFocus);
        window.addEventListener("focus", onFocus);
        return () => {
            window.removeEventListener("visibilitychange", onFocus);
            window.removeEventListener("focus", onFocus);
        };
    }, [autoRefresh, startDate, endDate]);

    // KPI
    const kpi = useMemo(() => {
        const sum = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
        return {
            talep: sum("Talep"),
            tedarik: sum("Tedarik"),
            verilemeyen: sum("Verilemeyen"),
            spot: sum("Spot"),
            filo: sum("Filo"),
        };
    }, [rows]);
    const totalUyum = useMemo(() => {
        const tTalep = rows.reduce((s, r) => s + (r.Talep || 0), 0);
        const tTed = rows.reduce((s, r) => s + (r.Tedarik || 0), 0);
        return tTalep > 0 ? Math.round((tTed / tTalep) * 100) : 0;
    }, [rows]);

    // filtre + arama + sıralama
    const viewRows = useMemo(() => {
        let list = [...rows];
        if (q.trim()) {
            const qq = q.trim().toLowerCase();
            list = list.filter((r) => r.ProjectName.toLowerCase().includes(qq));
        }
        if (onlyLow) list = list.filter((r) => (r.Talep > 0 ? (r.Tedarik / r.Talep) * 100 < 70 : false));
        if (onlyPending) list = list.filter((r) => (r.Verilemeyen || 0) > 0);

        const dir = sortDir === "asc" ? 1 : -1;
        list.sort((a, b) => {
            const A = a[sortKey] ?? (sortKey === "ProjectName" ? a.ProjectName : 0);
            const B = b[sortKey] ?? (sortKey === "ProjectName" ? b.ProjectName : 0);
            if (sortKey === "ProjectName") return String(A).localeCompare(String(B), "tr") * dir;
            return ((Number(A) || 0) - (Number(B) || 0)) * dir;
        });
        return list;
    }, [rows, q, onlyLow, onlyPending, sortKey, sortDir]);

    const changeSort = (key) => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir("desc"); }
    };

    const exportCsv = () => {
        const header = ["Proje", "Talep", "Tedarik", "Verilemeyen", "Spot", "Filo", "Uyum %"];
        const lines = [header.join(";")];
        viewRows.forEach((r) => {
            const uyum = r.Talep > 0 ? Math.round((r.Tedarik / r.Talep) * 100) : 0;
            lines.push([r.ProjectName, r.Talep, r.Tedarik, r.Verilemeyen, r.Spot, r.Filo, uyum].join(";"));
        });
        const csv = "\uFEFF" + lines.join("\n"); // Excel için BOM
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `odak_${startDate}_${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const rowPad = dense ? "py-1.5" : "py-2";

    return (
        <div className="relative min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-gray-100">
            {/* arka plan glow */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute right-[-10%] top-[-10%] h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl"></div>
                <div className="absolute left-[-10%] bottom-[-10%] h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl"></div>
            </div>

            {/* Üst Bar */}
            <header className="sticky top-0 z-30 border-b border-white/5 backdrop-blur supports-[backdrop-filter]:bg-gray-950/50">
                <div className="w-full flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="grid w-9 h-9 place-items-center rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/20">
                            <span className="text-white">🚚</span>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-widest text-gray-400">Lojistik Kontrol Merkezi</p>
                            <h1 className="text-lg font-semibold">CargoFlow</h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📅</span>
                            <input
                                type="date"
                                value={startDate}
                                max={endDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-40 rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm text-gray-200"
                            />
                        </div>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📅</span>
                            <input
                                type="date"
                                value={endDate}
                                min={startDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-40 rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm text-gray-200"
                            />
                        </div>

                        <div className="relative">
                            <input
                                placeholder="Proje ara…"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                className="w-52 rounded-xl border border-white/10 bg-white/5 pl-3 pr-9 py-2 text-sm text-gray-200 placeholder:text-gray-500"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
                        </div>

                        <Button variant="outline" onClick={() => handleLoad()}>
                            {refreshing ? (
                                <span className="inline-flex items-center gap-2">
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" fill="none" /></svg>
                                    Yenileniyor…
                                </span>
                            ) : ("Yenile")}
                        </Button>

                        <Button variant={autoRefresh ? "solid" : "outline"} onClick={() => setAutoRefresh(v => !v)} className={autoRefresh ? "" : "text-gray-300"}>
                            {autoRefresh ? "Oto Yenile: Açık" : "Oto Yenile: Kapalı"}
                        </Button>

                        <select
                            value={refreshMs}
                            onChange={(e) => setRefreshMs(parseInt(e.target.value, 10))}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200"
                            disabled={!autoRefresh}
                            title="Yenileme sıklığı"
                        >
                            <option value={30000}>30 sn</option>
                            <option value={60000}>1 dk</option>
                            <option value={120000}>2 dk</option>
                            <option value={300000}>5 dk</option>
                        </select>

                        <Button variant="outline" onClick={exportCsv}>⬇️ CSV</Button>
                        <ToggleChip active={dense} onClick={() => setDense(d => !d)}>Yoğun Mod</ToggleChip>
                    </div>
                </div>
            </header>

            {/* İçerik */}
            <main className="w-full space-y-6 px-6 py-6">
                {/* Skeleton (sadece ilk yük) */}
                {loading && !error && (
                    <>
                        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <GlowCard key={i}>
                                    <div className="p-5 animate-pulse">
                                        <div className="h-4 w-24 rounded bg-white/10 mb-4"></div>
                                        <div className="h-7 w-32 rounded bg-white/10"></div>
                                    </div>
                                </GlowCard>
                            ))}
                        </div>
                        <GlowCard>
                            <div className="p-5 animate-pulse">
                                <div className="h-4 w-52 rounded bg-white/10 mb-4"></div>
                                <div className="h-72 w-full rounded bg-white/10"></div>
                            </div>
                        </GlowCard>
                    </>
                )}

                {/* Hata */}
                {!loading && error && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Hata</CardTitle>
                            <CardDescription>ODAK verisi alınamadı</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm text-rose-300">{error}</CardContent>
                    </Card>
                )}

                {/* KPI’lar + filtre çipleri */}
                {!loading && !error && (
                    <>
                        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                            {[
                                { label: "Reel Talep", val: rows.reduce((s, r) => s + (r.Talep || 0), 0), icon: "📝" },
                                { label: "Reel Tedarik", val: rows.reduce((s, r) => s + (r.Tedarik || 0), 0), icon: "✅" },
                                { label: "Verilemeyen", val: rows.reduce((s, r) => s + (r.Verilemeyen || 0), 0), icon: "⚠️" },
                                { label: "Spot", val: rows.reduce((s, r) => s + (r.Spot || 0), 0), icon: "🚚" },
                                { label: "Filo", val: rows.reduce((s, r) => s + (r.Filo || 0), 0), icon: "🏷️" },
                            ].map((k, i) => (
                                <GlowCard key={i} className="h-28 hover:scale-[1.01] transition-transform">
                                    <CardHeader className="flex items-center justify-between pb-2">
                                        <div className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                            {k.icon} {k.label} <LiveDot ok={!refreshing} />
                                        </div>
                                        <Badge className="bg-white/10 text-gray-300 border-white/10">
                                            {lastUpdated ? `⏱ ${lastUpdated.toLocaleTimeString("tr-TR")}` : ""}
                                        </Badge>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-3xl font-semibold tracking-tight">{Number(k.val).toLocaleString("tr-TR")}</div>
                                    </CardContent>
                                </GlowCard>
                            ))}
                            <GlowCard className="h-28 hover:scale-[1.01] transition-transform">
                                <CardHeader className="flex items-center justify-between pb-2">
                                    <div className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                        🎯 Toplam Uyum <LiveDot ok={!refreshing} />
                                    </div>
                                    <Badge className="bg-white/10 text-gray-300 border-white/10">
                                        {lastUpdated ? `⏱ ${lastUpdated.toLocaleTimeString("tr-TR")}` : ""}
                                    </Badge>
                                </CardHeader>
                                <CardContent className="flex items-center gap-4">
                                    <UyumBar value={totalUyum} />
                                </CardContent>
                            </GlowCard>
                        </div>

                        {/* Filtre çipleri */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-400 mr-1">Filtreler:</span>
                            <ToggleChip active={onlyLow} onClick={() => setOnlyLow(v => !v)}>Uyum &lt; %70</ToggleChip>
                            <ToggleChip active={onlyPending} onClick={() => setOnlyPending(v => !v)}>Verilemeyen &gt; 0</ToggleChip>
                        </div>

                        {/* Proje tablosu */}
                        <GlowCard>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Projeler (ODAK - Reel)</CardTitle>
                                        <CardDescription>
                                            {startDate} – {endDate}
                                            {lastUpdated ? `  •  Güncellendi: ${lastUpdated.toLocaleTimeString("tr-TR")}` : ""}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {viewRows.length === 0 ? (
                                    <div className="p-5 text-sm text-gray-400">Kriterlere uyan veri bulunamadı.</div>
                                ) : (
                                    <div className="overflow-auto max-h-[calc(100vh-260px)]">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur">
                                                <tr className="border-b border-white/10 text-left text-gray-400">
                                                    {[
                                                        { k: "ProjectName", label: "Proje" },
                                                        { k: "Talep", label: "Talep" },
                                                        { k: "Tedarik", label: "Tedarik" },
                                                        { k: "Verilemeyen", label: "Verilemeyen" },
                                                        { k: "Spot", label: "Spot" },
                                                        { k: "Filo", label: "Filo" },
                                                        { k: "Uyum", label: "Uyum" },
                                                    ].map((c) => (
                                                        <th key={c.k} className={`${rowPad} px-3 ${c.k === "ProjectName" ? "pl-5" : ""}`}>
                                                            <button
                                                                onClick={() => changeSort(c.k === "Uyum" ? "Tedarik" : c.k)} // Uyum için Tedarik/Talep'e göre sort
                                                                className="inline-flex items-center gap-1 hover:text-gray-200"
                                                                title="Sırala"
                                                            >
                                                                {c.label}
                                                                {sortKey === c.k && (
                                                                    <span>{sortDir === "asc" ? "▲" : "▼"}</span>
                                                                )}
                                                            </button>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewRows.map((r, i) => {
                                                    const uyum = r.Talep > 0 ? Math.round((r.Tedarik / r.Talep) * 100) : 0;
                                                    const color = uyum < 70 ? "#e74c3c" : uyum < 90 ? "#f39c12" : "#27ae60";
                                                    return (
                                                        <tr
                                                            key={i}
                                                            className="border-b border-white/5 transition-colors hover:bg-white/5 odd:bg-white/[0.02] cursor-pointer"
                                                            onClick={() => { setModalProject(r); setModalOpen(true); }}
                                                            title="Detayları gör"
                                                        >
                                                            <td className={`${rowPad} pl-5 pr-3 font-medium text-gray-200`}>{r.ProjectName}</td>
                                                            <td className={`${rowPad} px-3 text-gray-300`}>{r.Talep}</td>
                                                            <td className={`${rowPad} px-3 text-gray-300`}>{r.Tedarik}</td>
                                                            <td className={`${rowPad} px-3 text-gray-300`}>{r.Verilemeyen}</td>
                                                            <td className={`${rowPad} px-3 text-gray-300`}>{r.Spot}</td>
                                                            <td className={`${rowPad} px-3 text-gray-300`}>{r.Filo}</td>
                                                            <td className={`${rowPad} px-3`} style={{ color }}>
                                                                <UyumBar value={uyum} />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t border-white/10 bg-white/5/5">
                                                    <td className={`${rowPad} pl-5`}><strong>TOPLAM</strong></td>
                                                    <td className={`${rowPad} px-3`}>{viewRows.reduce((s, r) => s + (r.Talep || 0), 0).toLocaleString("tr-TR")}</td>
                                                    <td className={`${rowPad} px-3`}>{viewRows.reduce((s, r) => s + (r.Tedarik || 0), 0).toLocaleString("tr-TR")}</td>
                                                    <td className={`${rowPad} px-3`}>{viewRows.reduce((s, r) => s + (r.Verilemeyen || 0), 0).toLocaleString("tr-TR")}</td>
                                                    <td className={`${rowPad} px-3`}>{viewRows.reduce((s, r) => s + (r.Spot || 0), 0).toLocaleString("tr-TR")}</td>
                                                    <td className={`${rowPad} px-3`}>{viewRows.reduce((s, r) => s + (r.Filo || 0), 0).toLocaleString("tr-TR")}</td>
                                                    <td className={`${rowPad} px-3`}><UyumBar value={(() => {
                                                        const tTalep = viewRows.reduce((s, r) => s + (r.Talep || 0), 0);
                                                        const tTed = viewRows.reduce((s, r) => s + (r.Tedarik || 0), 0);
                                                        return tTalep > 0 ? Math.round((tTed / tTalep) * 100) : 0;
                                                    })()} /></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </GlowCard>
                    </>
                )}
            </main>

            {/* Detay Modal */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={modalProject ? `Detay • ${modalProject.ProjectName}` : "Detay"}
            >
                {!modalProject ? (
                    <div className="text-sm text-gray-400">Kayıt yok.</div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <Card className="p-3"><div className="text-xs text-gray-400">Talep</div><div className="text-lg font-semibold">{modalProject.Talep}</div></Card>
                            <Card className="p-3"><div className="text-xs text-gray-400">Tedarik</div><div className="text-lg font-semibold">{modalProject.Tedarik}</div></Card>
                            <Card className="p-3"><div className="text-xs text-gray-400">Verilemeyen</div><div className="text-lg font-semibold">{modalProject.Verilemeyen}</div></Card>
                            <Card className="p-3"><div className="text-xs text-gray-400">Uyum</div><div className="text-lg font-semibold">
                                {modalProject.Talep > 0 ? Math.round((modalProject.Tedarik / modalProject.Talep) * 100) : 0}%
                            </div></Card>
                        </div>

                        <div className="overflow-auto max-h-[52vh]">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-white/10">
                                        <th className="py-2 pr-2">Talep No</th>
                                        <th className="py-2 pr-2">Sevkiyat</th>
                                        <th className="py-2 pr-2">Çalışma</th>
                                        <th className="py-2 pr-2">Sevk No</th>
                                        <th className="py-2 pr-2">Rota</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalProject.records.slice(0, 500).map((x, idx) => (
                                        <tr key={idx} className="border-b border-white/5">
                                            <td className="py-2 pr-2">{x.TMSVehicleRequestDocumentNo}</td>
                                            <td className="py-2 pr-2">{x.PickupDate?.split("T")[0] || "-"}</td>
                                            <td className="py-2 pr-2">{x.VehicleWorkingName || "-"}</td>
                                            <td className="py-2 pr-2">{x.TMSDespatchDocumentNo || "-"}</td>
                                            <td className="py-2 pr-2">{[x.FromCityName, x.ToCityName].filter(Boolean).join(" → ")}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {modalProject.records.length > 500 && (
                                <div className="text-xs text-gray-400 mt-2">(+{modalProject.records.length - 500} kayıt daha)</div>
                            )}
                        </div>
                    </>
                )}
            </Modal>

            {/* Alt Bilgi */}
            <footer className="w-full px-6 pb-10 pt-2 text-xs text-gray-500">
                © {new Date().getFullYear()} CargoFlow • ODAK verisiyle canlı görünüm
            </footer>
        </div>
    );
};

export default AnaSayfa;
