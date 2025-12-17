import React, { useEffect, useState } from "react";
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

// --- Veri Kartı Bileşeni ---
const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }) => (
    <motion.div
        whileHover={{ y: -4 }}
        className="relative overflow-hidden rounded-2xl border border-white/5 bg-gray-900/40 p-5 backdrop-blur-xl"
    >
        <div className="flex justify-between items-start text-left">
            <div>
                <p className="text-sm font-medium text-gray-400">{title}</p>
                <h3 className="mt-2 text-2xl font-bold text-white tracking-tight">
                    {value || "0"}
                </h3>
                <p className="mt-1 text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                    {subtitle}
                </p>
            </div>
            <div className={`rounded-xl p-3 ${colorClass}`}>
                <Icon size={22} className="text-white" />
            </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </motion.div>
);

const ActionButton = ({ icon: Icon, label, onClick, primary }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all
            ${primary
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 active:scale-95"
                : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 active:scale-95"}`}
    >
        <Icon size={18} />
        {label}
    </button>
);

const AnaSayfa = () => {
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Veri State'leri
    const [stats, setStats] = useState({
        gelir: "₺0,00",
        gider: "₺0,00",
        siparis: "0",
        kapasite: "%0"
    });

    const handleRefresh = async () => {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 600));
        setLastUpdated(new Date());
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#020617] text-gray-100 selection:bg-blue-500/30 font-sans pt-6">
            {/* Arka Plan Glow Efektleri */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[10%] w-[30%] h-[30%] bg-blue-600/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] bg-indigo-600/5 blur-[120px] rounded-full" />
            </div>

            <main className="mx-auto max-w-[1600px] px-6 space-y-8">

                {/* Aksiyon ve Başlık Alanı */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Operasyon Yönetimi</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Sistem Bağlantısı Aktif</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white transition-all active:rotate-180 duration-500"
                            title="Verileri Güncelle"
                        >
                            <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
                        </button>
                        <ActionButton icon={ArrowDownCircle} label="Gider Girişi" />
                        <ActionButton icon={TrendingUp} label="Gelir Girişi" />
                        <ActionButton icon={PlusCircle} label="Yeni Sipariş Oluştur" primary />
                    </div>
                </div>

                {/* Ana Metrik Kartları */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Dönemlik Gelir"
                        value={stats.gelir}
                        icon={TrendingUp}
                        subtitle="Onaylanmış İşlemler"
                        colorClass="bg-emerald-500/10 text-emerald-500"
                    />
                    <StatCard
                        title="Dönemlik Gider"
                        value={stats.gider}
                        icon={ArrowDownCircle}
                        subtitle="Sabit & Değişken"
                        colorClass="bg-rose-500/10 text-rose-500"
                    />
                    <StatCard
                        title="Bekleyen Sipariş"
                        value={stats.siparis}
                        icon={Package}
                        subtitle="Sevkiyat Hazırlığı"
                        colorClass="bg-blue-500/10 text-blue-500"
                    />
                    <StatCard
                        title="Filo Kapasitesi"
                        value={stats.kapasite}
                        icon={LayoutDashboard}
                        subtitle="Anlık Doluluk Oranı"
                        colorClass="bg-indigo-500/10 text-indigo-500"
                    />
                </div>

                {/* Alt Panel: Veri Tablosu İskeleti ve Bilgi Kutusu */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 pb-12">
                    <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-gray-900/40 backdrop-blur-xl flex flex-col min-h-[400px]">
                        <div className="flex items-center justify-between border-b border-white/5 p-5">
                            <div className="flex items-center gap-3">
                                <Layers size={18} className="text-blue-500" />
                                <h3 className="font-bold text-sm">Son Finansal Hareketler</h3>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <AnimatePresence mode="wait">
                                {loading ? (
                                    <motion.div
                                        key="loading"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="space-y-4 w-full max-w-md"
                                    >
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-white/5" />
                                        ))}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="empty"
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        className="flex flex-col items-center"
                                    >
                                        <div className="rounded-2xl bg-white/5 p-5 text-gray-700 mb-4 border border-white/5">
                                            <Database size={32} />
                                        </div>
                                        <h4 className="text-gray-400 font-semibold text-sm">Görüntülenecek veri bulunmuyor</h4>
                                        <p className="text-xs text-gray-600 mt-2 max-w-xs leading-relaxed">
                                            Operasyonel süreçlerinizi başlatmak için yukarıdaki butonları kullanarak ilk kaydınızı oluşturun.
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-2xl border border-white/5 bg-gray-900/40 backdrop-blur-xl p-6">
                            <div className="flex items-center gap-2 mb-6 text-gray-300 font-bold">
                                <Calendar size={18} className="text-blue-500" />
                                <h3 className="text-sm">Operasyonel Notlar</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Hatırlatıcı</p>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Gelir ve gider girişleriniz anlık olarak muhasebe panelinde izlenebilir hale gelmektedir.
                                    </p>
                                </div>
                                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition group text-left">
                                    <div>
                                        <p className="text-xs font-bold text-white">Raporlar</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Dönemlik özetleri inceleyin</p>
                                    </div>
                                    <ArrowRight size={16} className="text-gray-600 group-hover:text-blue-500 transition-transform group-hover:translate-x-1" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="mx-auto max-w-[1600px] border-t border-white/5 px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-gray-600 font-medium uppercase tracking-widest">
                <p>© {new Date().getFullYear()} FLEETPORTAL LOJİSTİK YÖNETİMİ</p>
                <div className="flex items-center gap-6">
                    <span>SON SENKRONİZASYON: {lastUpdated.toLocaleTimeString("tr-TR")}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/50" />
                    <span>V 4.0.0</span>
                </div>
            </footer>
        </div>
    );
};

export default AnaSayfa;