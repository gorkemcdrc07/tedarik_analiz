import React, { useEffect, useMemo, useRef, useState } from "react";
// import { List } from "react-window"; // List artık kullanılmıyor


// --- Yardımcı Bileşenler (Kullanımı azaltıldı) ---

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
// Badge, Button, LiveDot, UyumBar, ToggleChip, Modal artık ana render içinde kullanılmadığı için sadece tanımları kaldı.
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


const AnaSayfa = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    // Artık kullanılmadığı için sadeleştirme (dummy) amaçlı state'ler:
    const [startDate, setStartDate] = useState(todayStr); // Sadece console uyarılarını susturmak için tutuldu
    const [endDate, setEndDate] = useState(todayStr); // Sadece console uyarılarını susturmak için tutuldu

    const DEFAULT_REFRESH_MS = 120000;
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshMs, setRefreshMs] = useState(DEFAULT_REFRESH_MS);

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    // UI state'leri de işlevsizleşti
    const [dense, setDense] = useState(false);
    const [q, setQ] = useState("");
    const [modalOpen, setModalOpen] = useState(false);

    const busyRef = useRef(false);

    // handleLoad fonksiyonu artık sadece state simülasyonu yapar
    const handleLoad = async ({ initial = false } = {}) => {
        if (busyRef.current) return;
        busyRef.current = true;
        setError(null);
        initial ? setLoading(true) : setRefreshing(true);

        // Simülasyon gecikmesi
        await new Promise(resolve => setTimeout(resolve, initial ? 500 : 200));

        setLastUpdated(new Date());

        initial ? setLoading(false) : setRefreshing(false);
        busyRef.current = false;
    };


    useEffect(() => {
        handleLoad({ initial: true });
        // startDate ve endDate artık kullanılmıyor, ancak dependency listesinde tutulabilir.
    }, [startDate, endDate]);

    // otomatik yenileme (görünürken)
    useEffect(() => {
        if (!autoRefresh) return;
        const tick = () => { if (!document.hidden) handleLoad(); };
        const id = setInterval(tick, refreshMs);
        return () => clearInterval(id);
    }, [autoRefresh, refreshMs, startDate, endDate]); // dependency listesi korundu


    useEffect(() => {
        const onFocus = () => { if (!document.hidden && autoRefresh) handleLoad(); };
        window.addEventListener("visibilitychange", onFocus);
        window.addEventListener("focus", onFocus);
        return () => {
            window.removeEventListener("visibilitychange", onFocus);
            window.removeEventListener("focus", onFocus);
        };
    }, [autoRefresh, startDate, endDate]); // dependency listesi korundu


    // CSV Dışa Aktar fonksiyonu da işlevsizdir
    const exportCsv = () => {
        const header = ["Boş", "Veri"];
        const lines = [header.join(";")];

        const csv = "\uFEFF" + lines.join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `iskelet_${startDate}_${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };


    return (
        <div className="relative min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-gray-100">
            {/* arka plan glow */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute right-[-10%] top-[-10%] h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl"></div>
                <div className="absolute left-[-10%] bottom-[-10%] h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl"></div>
            </div>

            {/* Üst Bar (HEADER) TAMAMEN KALDIRILDI */}
            {/* <header className="sticky top-0 z-30 border-b border-white/5 backdrop-blur supports-[backdrop-filter]:bg-gray-950/50">
                ... Kontroller kaldırıldı ...
            </header> */}

            {/* İçerik */}
            <main className="w-full space-y-6 px-6 py-6 min-h-[90vh] flex flex-col justify-center items-center">

                {/* Yükleme Simülasyonu */}
                {loading && !error && (
                    <Card className="w-full max-w-lg">
                        <CardContent className="animate-pulse text-sm text-gray-400 text-center">İskelet yükleniyor...</CardContent>
                    </Card>
                )}

                {/* Hata Mesajı */}
                {!loading && error && (
                    <Card className="w-full max-w-lg">
                        <CardHeader>
                            <CardTitle>Hata</CardTitle>
                            <CardDescription>Uygulama İskeletinde Hata</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm text-rose-300">{error}</CardContent>
                    </Card>
                )}

                {/* Ana İçerik Alanı (Boş) */}
                {!loading && !error && (
                    <Card className="w-full max-w-lg">
                        <CardHeader>
                            <CardTitle>Boş İskelet</CardTitle>
                            <CardDescription>CargoFlow kontrol paneli kaldırılmıştır.</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm text-gray-400">
                            Sayfanın üst çubuğu (header), dashboard panelleri ve tablolar kaldırıldığı için bu alan boştur.
                            Sadece arka plan ve alt bilgi (footer) görünmektedir.
                            {lastUpdated && <p className="mt-2 text-xs">Son Yenileme Simülasyonu: {lastUpdated.toLocaleTimeString("tr-TR")}</p>}
                        </CardContent>
                    </Card>
                )}
            </main>

            {/* Detay Modal (Gereksiz ama tanım olarak bırakıldı) */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={"İşlev Devre Dışı"}
            >
                <div className="text-sm text-gray-400">Tüm veri bileşenleri kaldırıldığı için detay gösterimi devre dışıdır.</div>
            </Modal>

            {/* Alt Bilgi */}
            <footer className="w-full px-6 pb-10 pt-2 text-xs text-gray-500">
                © {new Date().getFullYear()} Sade İskelet • Tüm kontroller kaldırılmıştır.
            </footer>
        </div>
    );
};

export default AnaSayfa;