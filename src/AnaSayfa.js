import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    PlusCircle,
    TrendingUp,
    ArrowDownCircle,
    RefreshCcw,
    Package,
    Calendar,
    Database,
    Layers,
    ArrowRight
} from "lucide-react";

/* ---------- STAT CARD ---------- */
const StatCard = ({ title, value, icon: Icon, color }) => (
    <motion.div
        whileHover={{ scale: 1.04 }}
        className="relative rounded-2xl p-[1px] bg-gradient-to-br from-white/10 to-white/0"
    >
        <div className="rounded-2xl bg-[#0B1120] p-5 backdrop-blur-xl border border-white/5">
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-xs text-gray-400">{title}</p>
                    <h2 className="text-2xl font-bold mt-1 text-white">{value}</h2>
                </div>

                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon size={20} className="text-white" />
                </div>
            </div>

            <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
        </div>
    </motion.div>
);

/* ---------- BUTTON ---------- */
const ActionButton = ({ icon: Icon, label, primary }) => (
    <button
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
        ${primary
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:scale-105"
                : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
            }`}
    >
        <Icon size={18} />
        {label}
    </button>
);

/* ---------- MAIN ---------- */
const AnaSayfa = () => {
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const [stats] = useState({
        gelir: "₺124.800",
        gider: "₺32.400",
        siparis: "18",
        kapasite: "%72"
    });

    const refresh = async () => {
        setLoading(true);
        await new Promise(r => setTimeout(r, 700));
        setLastUpdated(new Date());
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white font-sans">

            {/* 🔥 BACKGROUND EFFECT */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute w-[500px] h-[500px] bg-blue-600/10 blur-[140px] top-[-100px] left-[-100px]" />
                <div className="absolute w-[500px] h-[500px] bg-indigo-600/10 blur-[140px] bottom-[-100px] right-[-100px]" />
            </div>

            <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">

                {/* HEADER */}
                <div className="flex justify-between items-center">

                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Operasyon Paneli
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            Sistem aktif • Canlı veri akışı
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={refresh}
                            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                        >
                            <RefreshCcw className={loading ? "animate-spin" : ""} size={18} />
                        </button>

                        <ActionButton icon={ArrowDownCircle} label="Gider" />
                        <ActionButton icon={TrendingUp} label="Gelir" />
                        <ActionButton icon={PlusCircle} label="Sipariş" primary />
                    </div>
                </div>

                {/* STATS */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                    <StatCard title="Gelir" value={stats.gelir} icon={TrendingUp} color="bg-emerald-500/20" />
                    <StatCard title="Gider" value={stats.gider} icon={ArrowDownCircle} color="bg-red-500/20" />
                    <StatCard title="Sipariş" value={stats.siparis} icon={Package} color="bg-blue-500/20" />
                    <StatCard title="Kapasite" value={stats.kapasite} icon={LayoutDashboard} color="bg-indigo-500/20" />
                </div>

                {/* CONTENT */}
                <div className="grid lg:grid-cols-3 gap-6">

                    {/* TABLE */}
                    <div className="lg:col-span-2 bg-[#0B1120] border border-white/5 rounded-2xl">

                        <div className="p-5 border-b border-white/5 flex items-center gap-2">
                            <Layers size={18} className="text-blue-400" />
                            <h3 className="text-sm font-semibold">Son Hareketler</h3>
                        </div>

                        <div className="p-8 flex justify-center items-center min-h-[300px]">

                            <AnimatePresence>
                                {loading ? (
                                    <div className="space-y-3 w-full">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-10 bg-white/5 animate-pulse rounded-lg" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <Database size={36} className="mx-auto text-gray-600 mb-3" />
                                        <p className="text-gray-400 text-sm">
                                            Henüz veri yok
                                        </p>
                                    </div>
                                )}
                            </AnimatePresence>

                        </div>
                    </div>

                    {/* SIDE */}
                    <div className="bg-[#0B1120] border border-white/5 rounded-2xl p-6 space-y-4">

                        <div className="flex items-center gap-2 text-gray-300">
                            <Calendar size={18} />
                            <h3 className="text-sm font-semibold">Notlar</h3>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-gray-300">
                            Sistem gerçek zamanlı çalışıyor.
                        </div>

                        <button className="w-full flex justify-between items-center p-4 bg-white/5 rounded-xl hover:bg-white/10">
                            <span>Raporlar</span>
                            <ArrowRight size={16} />
                        </button>

                    </div>
                </div>
            </main>

            {/* FOOTER */}
            <footer className="text-xs text-gray-500 flex justify-between max-w-[1400px] mx-auto px-6 py-6 border-t border-white/5">
                <span>© 2026</span>
                <span>{lastUpdated.toLocaleTimeString("tr-TR")}</span>
            </footer>
        </div>
    );
};

export default AnaSayfa;