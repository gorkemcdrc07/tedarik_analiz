// src/analiz/ozetTablo.js
import React, { useEffect, useMemo, useState } from "react";

/* ====== ENV ====== */
const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const ODAK_KEY = process.env.REACT_APP_ODAK_API_KEY || "";

/* ====== Mini UI (dark) ====== */
const Page = ({ children }) => (
    <div className="h-screen overflow-y-auto text-gray-100 bg-gradient-to-br from-gray-950 via-[#0b0f19] to-black">
        {children}
    </div>
);
const GlowCard = ({ children, className = "" }) => (
    <div className={`p-[1px] rounded-2xl bg-gradient-to-br from-white/15 via-white/5 to-transparent ${className}`}>
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

/* ====== Helpers ====== */
const onlyDate = (s) => (s ? s.split("T")[0] : null);
const toYmdLocal = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
// dd.MM.yyyy
const fmtTR = (iso) => {
    if (!iso) return "-";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
};

// VP*, BOS* ve tamamen boş olanları tekilleştirme anahtarı olarak kabul et
function normalizeForCount(v) {
    let s = (v ?? "").toString();
    try { s = s.normalize("NFKC"); } catch { }
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, "").trim().replace(/\s+/g, " ");
    if (!s) return "(BOŞ)";               // tamamen boşları tek bir anahtar altında topla
    const up = s.toUpperCase();
    if (up.startsWith("VP") || up.startsWith("BOS")) return up;
    if (up === "(BOŞ)") return up;
    return null;                          // kriter dışı (örn. FO*, SFR* vs. sayılmayacak)
}

function dayDiffPickupMinusCreated(pickup, created) {
    const p = onlyDate(pickup);
    const c = onlyDate(created);
    if (!p || !c) return null;
    const pd = new Date(p + "T00:00:00");
    const cd = new Date(c + "T00:00:00");
    return Math.round((pd - cd) / 86400000);
}

/* ====== API ====== */
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
        ProjectName: (it?.ProjectName || "-").toString().trim(),
        TMSVehicleRequestDocumentNo: (it?.TMSVehicleRequestDocumentNo ?? "").toString(),
        PickupDate: it?.PickupDate || null,
        // API'nizde "OrderCreatedDate" alanı böyleyse kullanıyoruz; farklıysa burayı kendi alanınıza göre değiştirin.
        OrderCreatedDate: it?.OrderCreatedDate || null,
        OrderStatu: typeof it?.OrderStatu === "number" ? it.OrderStatu : Number(it?.OrderStatu ?? NaN),
    }));
}

/* ====== Component ====== */
export default function OzetTablo() {
    // İçinde bulunduğumuz ay
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startDate = toYmdLocal(monthStart);
    const endDate = toYmdLocal(monthEnd);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Proje seçimi
    const [q, setQ] = useState("");
    const [selected, setSelected] = useState([]); // boşsa tüm projeler

    // Özet tablo filtreleri
    const [dayQuery, setDayQuery] = useState("");
    const [minRequested, setMinRequested] = useState("");

    useEffect(() => {
        (async () => {
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
        })();
    }, [startDate, endDate]);

    const allProjects = useMemo(() => {
        const set = new Set(rows.map((r) => r.ProjectName).filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
    }, [rows]);

    const filteredProjects = useMemo(() => {
        const term = q.trim().toLowerCase();
        return term ? allProjects.filter((p) => p.toLowerCase().includes(term)) : allProjects;
    }, [allProjects, q]);

    const activeProjects = useMemo(
        () => (selected.length ? selected : allProjects),
        [selected, allProjects]
    );

    // Proje x Gün benzersiz setleri
    const projDayAgg = useMemo(() => {
        const map = new Map();
        const active = new Set(activeProjects);
        const rank = { early: 3, ontime: 2, late: 1 };

        for (const r of rows) {
            if (!active.has(r.ProjectName)) continue;

            const day = onlyDate(r.PickupDate);
            if (!day) continue;

            const key = normalizeForCount(r.TMSVehicleRequestDocumentNo);
            if (key === null) continue; // sadece VP*, BOS*, (BOŞ)

            if (!map.has(r.ProjectName)) map.set(r.ProjectName, new Map());
            const dayMap = map.get(r.ProjectName);
            if (!dayMap.has(day))
                dayMap.set(day, {
                    all: new Set(),
                    cancelled: new Set(),
                    early: new Set(),
                    ontime: new Set(),
                    late: new Set(),
                    _chosen: new Map(), // docKey -> best class
                });

            const bucket = dayMap.get(day);

            // Benzersiz talep (VP/BOS/BOŞ)
            bucket.all.add(key);

            // İptal seti
            if (Number(r.OrderStatu) === 200) {
                bucket.cancelled.add(key);
            }

            // Sınıf (Erken/Zamanında/Geç) — PickupDate - OrderCreatedDate
            const diff = dayDiffPickupMinusCreated(r.PickupDate, r.OrderCreatedDate);
            if (diff !== null) {
                const code = diff > 0 ? "early" : diff === 0 ? "ontime" : "late";
                // aynı doküman için "en yüksek" sınıfı seç (early > ontime > late)
                const prev = bucket._chosen.get(key) || null;
                if (!prev || rank[code] > rank[prev]) {
                    bucket._chosen.set(key, code);
                }
            }
        }

        // Seçilen sınıfları iptal olmayanlar için dağıt
        for (const [, dayMap] of map.entries()) {
            for (const [, bucket] of dayMap.entries()) {
                for (const [docKey, cls] of bucket._chosen.entries()) {
                    if (bucket.cancelled.has(docKey)) continue; // İPTAL EDİLENLER sınıf sayımına girmez
                    if (cls === "early") bucket.early.add(docKey);
                    else if (cls === "ontime") bucket.ontime.add(docKey);
                    else if (cls === "late") bucket.late.add(docKey);
                }
                delete bucket._chosen;
            }
        }

        return map;
    }, [rows, activeProjects]);

    const tableRows = useMemo(() => {
        const out = [];
        for (const [project, dayMap] of projDayAgg.entries()) {
            for (const [day, b] of dayMap.entries()) {
                out.push({
                    project,
                    day,
                    requested: b.all.size,        // benzersiz (VP/BOS/BOŞ)
                    cancelled: b.cancelled.size,  // OrderStatu=200 benzersiz
                    early: b.early.size,          // iptal HARİÇ benzersiz
                    ontime: b.ontime.size,        // iptal HARİÇ benzersiz
                    late: b.late.size,            // iptal HARİÇ benzersiz
                });
            }
        }
        out.sort((a, b) => {
            if (a.day !== b.day) return b.day.localeCompare(a.day);
            return a.project.localeCompare(b.project, "tr");
        });

        const dq = dayQuery.trim().toLowerCase();
        const min = Number(minRequested);
        return out.filter((r) => {
            const passDay = dq ? fmtTR(r.day).toLowerCase().includes(dq) : true;
            const passMin = Number.isFinite(min) ? r.requested >= min : true;
            return passDay && passMin;
        });
    }, [projDayAgg, dayQuery, minRequested]);

    const totals = useMemo(
        () =>
            tableRows.reduce(
                (acc, r) => {
                    acc.requested += r.requested;
                    acc.cancelled += r.cancelled;
                    acc.early += r.early;
                    acc.ontime += r.ontime;
                    acc.late += r.late;
                    return acc;
                },
                { requested: 0, cancelled: 0, early: 0, ontime: 0, late: 0 }
            ),
        [tableRows]
    );

    const totalDen = Math.max(0, totals.requested - totals.cancelled);
    const totalPerf =
        totalDen > 0 ? Math.round(((totals.early + totals.ontime) / totalDen) * 100) : 0;

    const exportCsv = () => {
        const header = [
            "Proje Adı",
            "Yükleme Tarihi",
            "Talep Edilen",
            "İptal Edilen",
            "Erken Tedarik",
            "Zamanında Tedarik",
            "Geç Tedarik",
            "Tedarik Performans (%)",
        ];
        const lines = [header.join(";")];
        tableRows.forEach((r) => {
            const den = Math.max(0, r.requested - r.cancelled);
            const perf = den > 0 ? Math.round(((r.early + r.ontime) / den) * 100) : 0;
            lines.push(
                [r.project, fmtTR(r.day), r.requested, r.cancelled, r.early, r.ontime, r.late, `%${perf}`].join(
                    ";"
                )
            );
        });
        lines.push(
            ["TOPLAM", "", totals.requested, totals.cancelled, totals.early, totals.ontime, totals.late, `%${totalPerf}`].join(";")
        );
        const csv = "\uFEFF" + lines.join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ozet_${startDate}_${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Page>
            {/* Üst bar */}
            <header className="sticky top-0 z-30 border-b border-white/10 backdrop-blur bg-gray-950/60">
                <div className="w-full flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="grid w-10 h-10 place-items-center rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/20">
                            📋
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400">Analiz</p>
                            <h1 className="text-lg font-semibold">Günlük Talep (Benzersiz VP/BOS/BOŞ)</h1>
                            <div className="mt-1 flex flex-wrap gap-1">
                                {(selected.length ? selected : allProjects).map((p) => (
                                    <span
                                        key={p}
                                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-gray-200"
                                    >
                                        {p}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-400">Ay: {startDate} – {endDate}</div>
                        <Button onClick={exportCsv}>⬇️ CSV</Button>
                    </div>
                </div>
            </header>

            <main className="w-full px-6 py-6">
                {loading && !error && (
                    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
                        <GlowCard>
                            <CardContent>
                                <Skeleton className="h-6 w-40 mb-4" />
                                <Skeleton className="h-72 w-full" />
                            </CardContent>
                        </GlowCard>
                        <GlowCard className="md:col-span-2">
                            <CardContent>
                                <Skeleton className="h-6 w-60 mb-4" />
                                <Skeleton className="h-72 w-full" />
                            </CardContent>
                        </GlowCard>
                    </div>
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
                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                        {/* Sol: Proje seçimi */}
                        <GlowCard className="h-fit">
                            <CardHeader className="pb-2">
                                <CardTitle>ProjectName Seçimi</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Input
                                    placeholder="Projelerde ara…"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <Button onClick={() => setSelected(filteredProjects)}>Tümünü Seç</Button>
                                    <Button onClick={() => setSelected([])}>Temizle</Button>
                                </div>
                                <div className="max-h-[360px] overflow-auto rounded-xl border border-white/10">
                                    <ul className="divide-y divide-white/5">
                                        {filteredProjects.map((p) => {
                                            const active = selected.includes(p);
                                            return (
                                                <li
                                                    key={p}
                                                    className={`px-3 py-2 cursor-pointer text-sm flex items-center justify-between hover:bg-white/5 ${active ? "bg-white/5" : ""
                                                        }`}
                                                    onClick={() =>
                                                        setSelected((prev) =>
                                                            prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                                                        )
                                                    }
                                                    title={p}
                                                >
                                                    <span className="truncate">{p}</span>
                                                    <span
                                                        className={`ml-3 inline-block h-4 w-4 rounded border ${active ? "bg-cyan-500 border-cyan-400" : "bg-transparent border-white/20"
                                                            }`}
                                                    />
                                                </li>
                                            );
                                        })}
                                        {filteredProjects.length === 0 && (
                                            <li className="px-3 py-2 text-sm text-gray-400">Proje bulunamadı.</li>
                                        )}
                                    </ul>
                                </div>
                                <div className="text-xs text-gray-400">
                                    Seçili: {selected.length || "Tümü"} / {allProjects.length}
                                </div>
                            </CardContent>
                        </GlowCard>

                        {/* Sağ: Özet tablo + filtre barı */}
                        <GlowCard className="lg:col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle>Özet Tablo</CardTitle>
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <Input
                                        placeholder="Gün ara… (örn. 03.10, 2025)"
                                        value={dayQuery}
                                        onChange={(e) => setDayQuery(e.target.value)}
                                    />
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="Min talep"
                                        value={minRequested}
                                        onChange={(e) => setMinRequested(e.target.value)}
                                    />
                                    <div className="text-xs text-gray-400 md:text-right self-center">Satır: {tableRows.length}</div>
                                </div>
                            </CardHeader>

                            <CardContent className="p-0">
                                {tableRows.length === 0 ? (
                                    <div className="p-5 text-sm text-gray-400">Kriterlere uyan veri bulunamadı.</div>
                                ) : (
                                    <div className="overflow-auto max-h-[70vh]">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur">
                                                <tr className="border-b border-white/10 text-left text-gray-300">
                                                    <th className="py-2 pl-5 pr-3">Proje Adı</th>
                                                    <th className="py-2 px-3">Yükleme Tarihi</th>
                                                    <th className="py-2 px-3">Talep Edilen</th>
                                                    <th className="py-2 px-3">İptal Edilen</th>
                                                    <th className="py-2 px-3">Erken Tedarik</th>
                                                    <th className="py-2 px-3">Zamanında Tedarik</th>
                                                    <th className="py-2 px-3">Geç Tedarik</th>
                                                    <th className="py-2 px-3">Tedarik Performans</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableRows.map((r, idx) => {
                                                    const den = Math.max(0, r.requested - r.cancelled);
                                                    const perf = den > 0 ? Math.round(((r.early + r.ontime) / den) * 100) : 0;
                                                    const perfClass =
                                                        perf >= 90
                                                            ? "bg-emerald-500/20 text-emerald-300"
                                                            : perf >= 70
                                                                ? "bg-amber-500/20 text-amber-300"
                                                                : "bg-rose-500/20 text-rose-300";
                                                    return (
                                                        <tr key={`${r.project}-${r.day}-${idx}`} className="border-b border-white/5 odd:bg-white/[0.02]">
                                                            <td className="py-2 pl-5 pr-3">{r.project}</td>
                                                            <td className="py-2 px-3">{fmtTR(r.day)}</td>
                                                            <td className="py-2 px-3 font-semibold">{r.requested}</td>
                                                            <td className="py-2 px-3 font-semibold">{r.cancelled}</td>
                                                            <td className="py-2 px-3">{r.early}</td>
                                                            <td className="py-2 px-3">{r.ontime}</td>
                                                            <td className="py-2 px-3">{r.late}</td>
                                                            <td className="py-2 px-3">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${perfClass}`}>%{perf}</span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t border-white/10 bg-white/5/5">
                                                    <td className="py-2 pl-5 pr-3 font-semibold">TOPLAM</td>
                                                    <td className="py-2 px-3"></td>
                                                    <td className="py-2 px-3 font-semibold">{totals.requested}</td>
                                                    <td className="py-2 px-3 font-semibold">{totals.cancelled}</td>
                                                    <td className="py-2 px-3 font-semibold">{totals.early}</td>
                                                    <td className="py-2 px-3 font-semibold">{totals.ontime}</td>
                                                    <td className="py-2 px-3 font-semibold">{totals.late}</td>
                                                    <td className="py-2 px-3">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${totalPerf >= 90
                                                                    ? "bg-emerald-500/20 text-emerald-300"
                                                                    : totalPerf >= 70
                                                                        ? "bg-amber-500/20 text-amber-300"
                                                                        : "bg-rose-500/20 text-rose-300"
                                                                }`}
                                                        >
                                                            %{totalPerf}
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </GlowCard>
                    </div>
                )}
            </main>
        </Page>
    );
}
