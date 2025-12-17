// src/SiparisIslemleri/siparisAcanlar.js - SIDEBAR ENTEGRASYONUNA UYGUN HALE GETİRİLDİ
import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

/* ====== ENV (DEĞİŞMEDİ) ====== */
const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const ODAK_KEY = process.env.REACT_APP_ODAK_API_KEY || "";

/* ====== UI (DEĞİŞMEDİ) ====== */
const GlowCard = ({ children, className = "" }) => (
    <div className={`p-[1px] rounded-2xl bg-gradient-to-br from-white/20 via-white/10 to-transparent ${className}`}>
        <div className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur">{children}</div>
    </div>
);
const Card = ({ children, className = "" }) => (
    <div className={`rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = "" }) => <div className={`px-5 pt-4 ${className}`}>{children}</div>;
const CardTitle = ({ children, className = "" }) => <h3 className={`text-base font-semibold ${className}`}>{children}</h3>;
const CardContent = ({ children, className = "" }) => <div className={`p-5 ${className}`}>{children}</div>;
const Button = ({ children, className = "", ...props }) => (
    <button
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition
        bg-white/10 hover:bg-white/20 border border-white/10 text-gray-100 ${className}`}
        {...props}
    >
        {children}
    </button>
);
const Input = (props) => (
    <input
        className="block w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20"
        {...props}
    />
);
const Skeleton = ({ className = "" }) => <div className={`animate-pulse bg-white/10 rounded ${className || "h-4 w-full"}`} />;

const Modal = ({ open, onClose, title, children }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="w-full max-w-3xl rounded-2xl border border-white/10 bg-gray-900/90"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button onClick={onClose} className="rounded-lg px-2 py-1 bg-white/10 hover:bg-white/20">
                        ✕
                    </button>
                </div>
                <div className="p-5 max-h-[70vh] overflow-auto">{children}</div>
            </div>
        </div>
    );
};

/* ====== Domain: kullanıcı listesi (DEĞİŞMEDİ) ====== */
const RAW_ALLOWED_USERS = ["IŞIL GÖKÇE KATRAN", "YASEMİN YILMAZ", "HALİT BAKACAK", "EZGİ GÜNAY", "İDİL ÇEVİK"];
const norm = (s) => (s || "").toString().trim().toUpperCase();
const ALLOWED_USERS = new Set(RAW_ALLOWED_USERS.map(norm));

/* ====== Helpers (DEĞİŞMEDİ) ====== */
function addDays(dateStr, delta) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
}
async function fetchOdakData(startDate, endDate) {
    if (!API_BASE || !ODAK_KEY) throw new Error("ODAK ENV eksik (REACT_APP_API_BASE_URL / REACT_APP_ODAK_API_KEY).");
    const payload = { startDate: `${startDate}T00:00:00`, endDate: `${endDate}T23:59:59`, userId: 1 };

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

    return items.map((it) => ({
        OrderCreatedBy: norm(it?.OrderCreatedBy) || "-",
        ProjectName: (it?.ProjectName || "-").toString(),
        TMSVehicleRequestDocumentNo: (it?.TMSVehicleRequestDocumentNo || "-").toString(),
        OrderCreatedDate: it?.OrderCreatedDate || null,
        RefDate: it?.OrderCreatedDate || it?.PickupDate || null,
        OrderStatu: typeof it?.OrderStatu === "number" ? it.OrderStatu : Number(it?.OrderStatu ?? NaN),
        OrderClosingReasonName: (it?.OrderClosingReasonName ?? "").toString().trim(),
        OrderClosedDate: it?.OrderClosedDate || null,
    }));
}
function fmtHm(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "00:00";
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ----------------------------------------------------
// ANA BİLEŞEN
// ----------------------------------------------------

export default function SiparisAcanlar() {
    const today = new Date().toISOString().slice(0, 10);

    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const weekStart = useMemo(() => addDays(endDate, -6), [endDate]);
    const [rowsWeek, setRowsWeek] = useState([]);
    const [loadingWeek, setLoadingWeek] = useState(false);

    const [detailUser, setDetailUser] = useState(null);

    // Veri Yükleme Fonksiyonları ve useEffect'ler (DEĞİŞMEDİ)
    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchOdakData(startDate, endDate);
            setRows(data);
        } catch (e) {
            setError(e.message || "Veri alınamadı");
            setRows([]);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load(); /* eslint-disable-line */
    }, [startDate, endDate]);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoadingWeek(true);
            try {
                const data = await fetchOdakData(weekStart, endDate);
                if (alive) setRowsWeek(data);
            } catch (_e) {
                if (alive) setRowsWeek([]);
            } finally {
                if (alive) setLoadingWeek(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [weekStart, endDate]);

    // Hesaplanan Değerler (useMemo'lar - DEĞİŞMEDİ)
    const allowedRows = useMemo(() => rows.filter((r) => ALLOWED_USERS.has(r.OrderCreatedBy)), [rows]);
    const allowedRowsWeek = useMemo(() => rowsWeek.filter((r) => ALLOWED_USERS.has(r.OrderCreatedBy)), [rowsWeek]);

    const filtered = useMemo(() => {
        const s = new Date(startDate + "T00:00:00").getTime();
        const e = new Date(endDate + "T23:59:59").getTime();
        return allowedRows.filter((r) => {
            if (!r.RefDate) return false;
            const t = new Date(r.RefDate).getTime();
            return Number.isFinite(t) && t >= s && t <= e;
        });
    }, [allowedRows, startDate, endDate]);

    // ✅ SATIR SAYISI: kullanıcı bazlı toplam satır + proje bazlı satır
    const { leaderboard, userProjectMap } = useMemo(() => {
        const userCount = new Map(); // user -> row count
        const userProjCount = new Map(); // user -> (project -> row count)

        for (const r of filtered) {
            const user = r.OrderCreatedBy || "-";
            const proj = (r.ProjectName || "-").trim();

            userCount.set(user, (userCount.get(user) || 0) + 1);

            if (!userProjCount.has(user)) userProjCount.set(user, new Map());
            const pMap = userProjCount.get(user);
            pMap.set(proj, (pMap.get(proj) || 0) + 1);
        }

        const lb = Array.from(userCount.entries())
            .map(([OrderCreatedBy, Count]) => ({ OrderCreatedBy, Count }))
            .sort((a, b) => b.Count - a.Count);

        return { leaderboard: lb, userProjectMap: userProjCount };
    }, [filtered]);

    const userRecordsMapWeek = useMemo(() => {
        const m = new Map();
        for (const r of allowedRowsWeek) {
            const u = r.OrderCreatedBy || "-";
            if (!m.has(u)) m.set(u, []);
            m.get(u).push(r);
        }
        return m;
    }, [allowedRowsWeek]);

    const COLORS = ["#60A5FA", "#34D399", "#FBBF24", "#F472B6", "#A78BFA", "#F87171", "#22D3EE"];

    const topProjectsFor = (user, limit = 3) => {
        const pMap = userProjectMap.get(user) || new Map();
        const arr = Array.from(pMap.entries())
            .map(([p, count]) => ({ ProjectName: p, Count: count }))
            .sort((a, b) => b.Count - a.Count);
        return { top: arr.slice(0, limit), restCount: Math.max(0, arr.length - limit) };
    };

    const buildDetailStats = (user) => {
        const recsRaw = userRecordsMapWeek.get(user) || [];
        const startDateObj = new Date(weekStart + "T00:00:00");
        const endDateObj = new Date(endDate + "T23:59:59");
        const tsStart = startDateObj.getTime();
        const tsEnd = endDateObj.getTime();

        const windowDays = Math.max(1, Math.floor((endDateObj - startDateObj) / 86400000) + 1);

        const recs = recsRaw
            .map((r) => {
                const createdTs = r.OrderCreatedDate ? new Date(r.OrderCreatedDate).getTime() : NaN;
                const refTs = r.RefDate ? new Date(r.RefDate).getTime() : NaN;
                const ts = Number.isFinite(createdTs) ? createdTs : refTs;
                return { ...r, ts, createdTs };
            })
            .filter((r) => Number.isFinite(r.ts) && r.ts >= tsStart && r.ts <= tsEnd)
            .sort((a, b) => a.ts - b.ts);

        if (recs.length === 0) {
            return {
                lastTime: "-",
                avgDailySpanHM: "00:00",
                avgOrdersPerDay: 0,
                avgDailySpanActiveHM: "00:00",
                avgOrdersPerActiveDay: 0,
                avgIntervalMin: 0,
                activeDays: 0,
                totalOrders: 0,
                busiestDay: null,
                longestSpan: null,
                perDayRows: [],
                windowDays,
            };
        }

        const lastCreated = recs.filter((x) => Number.isFinite(x.createdTs)).slice(-1)[0];
        const lastAny = recs[recs.length - 1];
        const lastTime = new Date(lastCreated?.createdTs ?? lastAny.ts);

        const dayMap = new Map();
        for (const r of recs) {
            const key = new Date(r.ts).toISOString().slice(0, 10);
            if (!dayMap.has(key)) dayMap.set(key, []);
            dayMap.get(key).push(r.ts);
        }

        let spanSum = 0;
        let activeDays = 0;
        let ordersSum = 0;
        let intervalSum = 0;
        let intervalCount = 0;

        let busiestDay = null;
        let longestSpan = null;

        const perDayRows = [];
        for (const [day, list] of dayMap.entries()) {
            list.sort((a, b) => a - b);
            const first = list[0];
            const last = list[list.length - 1];
            const spanMs = last - first;
            const count = list.length;

            spanSum += spanMs;
            activeDays += 1;
            ordersSum += count;

            if (!busiestDay || count > busiestDay.orders) busiestDay = { day, orders: count };
            if (!longestSpan || spanMs > longestSpan.spanMs) longestSpan = { day, spanMs, spanHM: fmtHm(spanMs) };

            if (count > 1) {
                let localIntervals = 0;
                for (let i = 1; i < list.length; i++) {
                    localIntervals += (list[i] - list[i - 1]) / 60000;
                }
                intervalSum += localIntervals / (count - 1);
                intervalCount += 1;
            }

            perDayRows.push({ day, orders: count, spanHM: fmtHm(spanMs) });
        }

        const avgDailySpanHM = fmtHm(spanSum / windowDays);
        const avgOrdersPerDay = +(ordersSum / windowDays).toFixed(2);
        const avgDailySpanActiveHM = fmtHm(activeDays > 0 ? spanSum / activeDays : 0);
        const avgOrdersPerActiveDay = activeDays > 0 ? +(ordersSum / activeDays).toFixed(2) : 0;
        const avgIntervalMin = intervalCount > 0 ? +(intervalSum / intervalCount).toFixed(1) : 0;

        return {
            lastTime: lastTime.toLocaleString("tr-TR"),
            avgDailySpanHM,
            avgOrdersPerDay,
            avgDailySpanActiveHM,
            avgOrdersPerActiveDay,
            avgIntervalMin,
            activeDays,
            totalOrders: ordersSum,
            busiestDay,
            longestSpan,
            perDayRows: perDayRows.sort((a, b) => b.day.localeCompare(a.day)),
            windowDays,
        };
    };

    const tableRows = useMemo(() => {
        const s = new Date(startDate + "T00:00:00").getTime();
        const e = new Date(endDate + "T23:59:59").getTime();
        const totalDays = Math.max(1, Math.floor((e - s) / 86400000) + 1);

        return RAW_ALLOWED_USERS.map((display) => {
            const key = norm(display);

            const recs = allowedRows
                .filter((r) => r.OrderCreatedBy === key && r.OrderCreatedDate)
                .map((r) => new Date(r.OrderCreatedDate).getTime())
                .filter((t) => Number.isFinite(t) && t >= s && t <= e)
                .sort((a, b) => a - b);

            const dayMap = new Map();
            for (const ts of recs) {
                const d = new Date(ts).toISOString().slice(0, 10);
                if (!dayMap.has(d)) dayMap.set(d, []);
                dayMap.get(d).push(ts);
            }
            let spanSum = 0;
            let ordersSum = 0;
            for (const list of dayMap.values()) {
                list.sort((a, b) => a - b);
                const span = list[list.length - 1] - list[0];
                spanSum += span;
                ordersSum += list.length;
            }

            const avgDailySpanHM = fmtHm(spanSum / totalDays);
            const avgOrdersPerDay = +(ordersSum / totalDays).toFixed(2);

            return { display, key, avgDailySpanHM, avgOrdersPerDay };
        });
    }, [allowedRows, startDate, endDate]);

    const { pieData } = useMemo(() => {
        const data = (leaderboard || [])
            .filter(Boolean)
            .map((d) => ({ OrderCreatedBy: String(d?.OrderCreatedBy || "-"), Count: Number(d?.Count || 0) }))
            .filter((d) => d.Count > 0);
        return { pieData: data };
    }, [leaderboard]);

    /* ====== 🔹 Kapanan Siparişler Analizi ====== */
    const closingRows = useMemo(() => {
        const rows200 = filtered.filter((r) => Number(r.OrderStatu) === 200);
        const map = new Map(); // ProjectName -> (Reason -> { count, latestTs })

        for (const r of rows200) {
            const proj = (r.ProjectName || "-").trim();
            const reason = (r.OrderClosingReasonName || "(Neden yok)").trim() || "(Neden yok)";
            const closedTs = r.OrderClosedDate ? Date.parse(r.OrderClosedDate) : NaN;

            if (!map.has(proj)) map.set(proj, new Map());
            const m2 = map.get(proj);

            if (!m2.has(reason)) {
                m2.set(reason, { count: 0, latestTs: Number.NEGATIVE_INFINITY });
            }
            const obj = m2.get(reason);
            obj.count += 1;
            if (Number.isFinite(closedTs) && closedTs > obj.latestTs) obj.latestTs = closedTs;
            m2.set(reason, obj);
        }

        const out = [];
        for (const [proj, m2] of map.entries()) {
            for (const [reason, { count, latestTs }] of m2.entries()) {
                out.push({
                    ProjectName: proj,
                    OrderClosingReasonName: reason,
                    Count: count,
                    LastClosedAt: Number.isFinite(latestTs) ? new Date(latestTs).toLocaleString("tr-TR") : "-",
                });
            }
        }

        out.sort(
            (a, b) =>
                a.ProjectName.localeCompare(b.ProjectName, "tr") ||
                b.Count - a.Count ||
                a.OrderClosingReasonName.localeCompare(b.OrderClosingReasonName, "tr")
        );
        return out;
    }, [filtered]);

    // ----------------------------------------------------
    // RENDER (Layout Entegrasyonuna uygun hale getirildi)
    // ----------------------------------------------------

    return (
        <div className="relative w-full text-gray-100 pl-0 md:pl-[var(--sidebar-width,260px)]">
            {/* Arka plan glow */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -top-16 -right-16 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />
            </div>

            <header className="sticky top-16 z-20 border-b border-white/10 backdrop-blur bg-gray-950/60">
                <div className="w-full flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="grid w-10 h-10 place-items-center rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/20">
                            📊
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400">Sipariş Açanlar</p>
                            <h1 className="text-lg font-semibold">Kullanıcı Liderliği (Günlük Ortalamalar + Proje)</h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">📅</span>
                            <Input
                                type="date"
                                value={startDate}
                                max={endDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ paddingLeft: 30, width: 160 }}
                            />
                        </div>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">📅</span>
                            <Input
                                type="date"
                                value={endDate}
                                min={startDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ paddingLeft: 30, width: 160 }}
                            />
                        </div>
                        <Button onClick={load} title="Yenile">
                            <RefreshCw className="w-4 h-4" /> Yenile
                        </Button>
                    </div>
                </div>
            </header>

            <main className="w-full space-y-6 px-6 py-6">
                {(loading || loadingWeek) && !error && (
                    <>
                        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <GlowCard key={i}>
                                    <div className="p-5">
                                        <Skeleton className="h-4 w-24 mb-3" />
                                        <Skeleton className="h-8 w-32" />
                                    </div>
                                </GlowCard>
                            ))}
                        </div>
                        <GlowCard>
                            <div className="p-5">
                                <Skeleton className="h-80 w-full" />
                            </div>
                        </GlowCard>
                    </>
                )}

                {!loading && error && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Hata</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-rose-300">{error}</CardContent>
                    </Card>
                )}

                {!loading && !error && (
                    <>
                        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                            <GlowCard className="md:col-span-2">
                                <CardHeader className="pb-2">
                                    <CardTitle>Kullanıcı Bazlı Günlük Ortalamalar</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-auto">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur">
                                                <tr className="border-b border-white/10 text-left text-gray-300">
                                                    <th className="py-2 pl-5 pr-3">Kullanıcı</th>
                                                    <th className="py-2 px-3">Günlük Ort. Açma Süresi</th>
                                                    <th className="py-2 px-3">Günlük Ort. Sipariş</th>
                                                    <th className="py-2 px-3">Detay</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableRows.map((r) => (
                                                    <tr key={r.key} className="border-b border-white/5 odd:bg-white/[0.02]">
                                                        <td className="py-2 pl-5 pr-3 font-medium">{r.display}</td>
                                                        <td className="py-2 px-3">{r.avgDailySpanHM}</td>
                                                        <td className="py-2 px-3">{r.avgOrdersPerDay}</td>
                                                        <td className="py-2 px-3">
                                                            <Button onClick={() => setDetailUser(r.key)}>Detay</Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </GlowCard>

                            <GlowCard className="md:col-span-2">
                                <CardHeader className="pb-2">
                                    <CardTitle>OrderCreatedBy → Sipariş (Satır) Dağılımı</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {pieData.length === 0 ? (
                                        <div className="text-sm text-gray-400">Kayıt bulunamadı.</div>
                                    ) : (
                                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                            <div className="w-full h-[280px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            dataKey="Count"
                                                            nameKey="OrderCreatedBy"
                                                            data={pieData}
                                                            outerRadius={110}
                                                            innerRadius={55}
                                                            paddingAngle={2}
                                                            isAnimationActive={false}
                                                        >
                                                            {pieData.map((_, i) => (
                                                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip formatter={(v, _n, p) => [`${v} satır`, p?.payload?.OrderCreatedBy || ""]} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-300">
                                                {pieData.map((d, i) => (
                                                    <span key={`${d.OrderCreatedBy}-${i}`} className="inline-flex items-center gap-2">
                                                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                                                        <span>
                                                            {d.OrderCreatedBy} <span className="text-gray-400">({d.Count})</span>
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </CardContent>
                            </GlowCard>
                        </div>

                        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
                            {pieData.map((u, idx) => {
                                const { top, restCount } = topProjectsFor(u.OrderCreatedBy, 3);
                                return (
                                    <GlowCard key={`${u.OrderCreatedBy}-${idx}`} className="hover:scale-[1.01] transition-transform">
                                        <CardContent className="space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-xs uppercase tracking-wider text-gray-400">Kullanıcı</div>
                                                    <div className="text-base font-semibold text-gray-100">{u.OrderCreatedBy}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-400">Sipariş (Satır)</div>
                                                    <div className="text-2xl font-bold">{u.Count}</div>
                                                </div>
                                            </div>

                                            <div className="text-xs text-gray-400">Projeler (Satır):</div>
                                            <div className="flex flex-wrap gap-2">
                                                {top.length === 0 ? (
                                                    <span className="text-sm text-gray-400">-</span>
                                                ) : (
                                                    top.map((p) => (
                                                        <span
                                                            key={p.ProjectName}
                                                            title={`${p.ProjectName}: ${p.Count}`}
                                                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs"
                                                        >
                                                            {p.ProjectName}
                                                            <span className="rounded bg-white/10 px-1">{p.Count}</span>
                                                        </span>
                                                    ))
                                                )}
                                                {restCount > 0 && (
                                                    <button
                                                        onClick={() => setDetailUser(u.OrderCreatedBy)}
                                                        className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20"
                                                        title="Tüm projeleri gör"
                                                    >
                                                        +{restCount} diğer
                                                    </button>
                                                )}
                                            </div>

                                            <div className="pt-1">
                                                <Button className="w-full" onClick={() => setDetailUser(u.OrderCreatedBy)}>
                                                    Detayları Göster
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </GlowCard>
                                );
                            })}
                            {pieData.length === 0 && (
                                <Card>
                                    <CardContent>Seçilen aralıkta kullanıcı verisi bulunamadı.</CardContent>
                                </Card>
                            )}
                        </div>

                        <GlowCard>
                            <CardHeader className="pb-2">
                                <CardTitle>Kapanan Siparişler (OrderStatu = 200) • Kapanış Nedenleri</CardTitle>
                                <div className="text-xs text-gray-400 mt-1">
                                    Aralık: {startDate} – {endDate} • Satır: {closingRows.length}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {closingRows.length === 0 ? (
                                    <div className="p-4 text-sm text-gray-400">Bu aralıkta kapanan sipariş bulunamadı.</div>
                                ) : (
                                    <div className="overflow-auto max-h-[60vh]">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur">
                                                <tr className="border-b border-white/10 text-left text-gray-300">
                                                    <th className="py-2 pl-5 pr-3">ProjectName</th>
                                                    <th className="py-2 px-3">OrderClosingReasonName</th>
                                                    <th className="py-2 px-3">Adet</th>
                                                    <th className="py-2 px-3">Son Kapanış</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {closingRows.map((r, i) => (
                                                    <tr key={`${r.ProjectName}-${r.OrderClosingReasonName}-${i}`} className="border-b border-white/5 odd:bg-white/[0.02]">
                                                        <td className="py-2 pl-5 pr-3 font-medium">{r.ProjectName}</td>
                                                        <td className="py-2 px-3">{r.OrderClosingReasonName}</td>
                                                        <td className="py-2 px-3">{r.Count}</td>
                                                        <td className="py-2 px-3">{r.LastClosedAt}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </GlowCard>
                    </>
                )}
            </main>

            <Modal open={!!detailUser} onClose={() => setDetailUser(null)} title={detailUser ? `Detay • ${detailUser}` : "Detay"}>
                {!detailUser ? (
                    <div className="text-sm text-gray-400">Kayıt yok.</div>
                ) : loadingWeek ? (
                    <div className="text-sm text-gray-400">Haftalık analiz yükleniyor…</div>
                ) : (
                    (() => {
                        const pMap = userProjectMap.get(detailUser) || new Map();
                        const projRows = Array.from(pMap.entries())
                            .map(([ProjectName, count]) => ({ ProjectName, Count: count }))
                            .sort((a, b) => b.Count - a.Count);

                        const stats = buildDetailStats(detailUser);

                        return (
                            <div className="space-y-6">
                                <Card className="p-4">
                                    <div className="text-xs text-gray-300">
                                        <strong>Son 1 haftada:</strong> {weekStart} – {endDate} • <strong>Veri bulunan gün:</strong> {stats.activeDays} /{" "}
                                        {stats.windowDays}
                                    </div>
                                </Card>

                                <Card className="p-4">
                                    <div className="text-xs text-gray-400 mb-2">Analiz (Son 1 Hafta)</div>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li>
                                            <strong>Son işlem:</strong> {stats.lastTime}
                                        </li>
                                        <li>
                                            <strong>Aktif gün:</strong> {stats.activeDays} gün
                                        </li>
                                        <li>
                                            <strong>Toplam sipariş (satır):</strong> {stats.totalOrders}
                                        </li>
                                        {stats.busiestDay && (
                                            <li>
                                                <strong>En yoğun gün:</strong> {stats.busiestDay.day} ({stats.busiestDay.orders} sipariş)
                                            </li>
                                        )}
                                        {stats.longestSpan && (
                                            <li>
                                                <strong>En uzun açma süresi (gün içi):</strong> {stats.longestSpan.day} ({stats.longestSpan.spanHM})
                                            </li>
                                        )}
                                        <li>
                                            <strong>Günlük ort. açma süresi (7 gün):</strong> {stats.avgDailySpanHM}
                                        </li>
                                        <li>
                                            <strong>Günlük ort. sipariş (7 gün):</strong> {stats.avgOrdersPerDay}
                                        </li>
                                        <li>
                                            <strong>Ort. iki sipariş arası:</strong> {stats.avgIntervalMin} dk
                                        </li>
                                    </ul>
                                </Card>

                                {stats.perDayRows.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle>Gün Bazında Özet (Son 1 Hafta)</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="overflow-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-left text-gray-300 border-b border-white/10">
                                                            <th className="py-2 pr-2">Tarih</th>
                                                            <th className="py-2 pr-2">Sipariş Adedi</th>
                                                            <th className="py-2 pr-2">İlk–Son Arası</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {stats.perDayRows.slice(0, 10).map((x, idx) => (
                                                            <tr key={idx} className="border-b border-white/5">
                                                                <td className="py-2 pr-2">{x.day}</td>
                                                                <td className="py-2 pr-2">{x.orders}</td>
                                                                <td className="py-2 pr-2">{x.spanHM}</td>
                                                            </tr>
                                                        ))}
                                                        {stats.perDayRows.length > 10 && (
                                                            <tr>
                                                                <td className="text-xs text-gray-400 p-3" colSpan={3}>
                                                                    (+{stats.perDayRows.length - 10} gün daha)
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle>Proje Dağılımı (Satır)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-left text-gray-300 border-b border-white/10">
                                                        <th className="py-2 pr-2">ProjectName</th>
                                                        <th className="py-2 pr-2">Satır</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {projRows.map((x, idx) => (
                                                        <tr key={idx} className="border-b border-white/5">
                                                            <td className="py-2 pr-2">{x.ProjectName}</td>
                                                            <td className="py-2 pr-2">{x.Count}</td>
                                                        </tr>
                                                    ))}
                                                    {projRows.length === 0 && (
                                                        <tr>
                                                            <td className="py-2 pr-2 text-gray-400" colSpan={2}>
                                                                Proje bulunamadı.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        );
                    })()
                )}
            </Modal>
        </div>
    );
}
