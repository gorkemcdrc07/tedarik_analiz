import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Helpers ---
const readUserName = () => {
    try {
        const raw = localStorage.getItem("kullanici");
        if (!raw) return "";
        const parsed = JSON.parse(raw);
        return (parsed && parsed.kullanici) ? parsed.kullanici : "";
    } catch { return ""; }
};

// --- Minimalist İkonlar ---
const Icon = {
    LogOut: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
    ),
    User: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
    ),
    Menu: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
    ),
    ChevronDown: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    )
};

const UserMenu = ({ initials, kullaniciIsmi }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    const handleLogout = () => {
        localStorage.clear();
        window.location.reload();
    };

    useEffect(() => {
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-2 py-1.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300"
            >
                <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white text-[10px] font-black tracking-tighter shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                        {initials}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#020617] rounded-full" />
                </div>
                <span className="hidden sm:block text-xs font-bold text-gray-200 tracking-wide uppercase">
                    {kullaniciIsmi || "Admin"}
                </span>
                <Icon.ChevronDown />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-52 rounded-2xl bg-[#0f172a] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-[110]"
                    >
                        <div className="p-2 space-y-1">
                            <button className="flex items-center gap-3 w-full px-4 py-3 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                                <Icon.User /> PROFİLİM
                            </button>
                            <div className="h-px bg-white/5 mx-2" />
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 w-full px-4 py-3 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                            >
                                <Icon.LogOut /> ÇIKIŞ YAP
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [kullaniciIsmi, setKullaniciIsmi] = useState("");

    useEffect(() => {
        setKullaniciIsmi(readUserName());
    }, []);

    const initials = useMemo(() => (
        kullaniciIsmi ? kullaniciIsmi.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "AD"
    ), [kullaniciIsmi]);

    return (
        <header className="sticky top-0 z-[100] w-full px-4 py-4">
            {/* Floating Glass Navbar */}
            <div className="max-w-7xl mx-auto relative group">
                {/* Outer Glow Line */}
                <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-600/20 via-indigo-500/20 to-purple-600/20 rounded-[22px] blur-sm opacity-50 group-hover:opacity-100 transition duration-1000" />

                <nav className="relative flex items-center justify-between h-16 px-6 rounded-[20px] bg-[#020617]/80 backdrop-blur-2xl border border-white/10">

                    {/* Logo Area */}
                    <div className="flex items-center gap-10">
                        <motion.a
                            href="#/"
                            whileHover={{ scale: 1.02 }}
                            className="flex items-center gap-3"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
                                <span className="text-white font-black text-sm tracking-tighter">STS</span>
                            </div>
                            <span className="text-lg font-black tracking-[0.2em] text-white uppercase hidden lg:block">
                                Fleet<span className="text-blue-500">OS</span>
                            </span>
                        </motion.a>

                        {/* Desktop Links - Minimalist Caps */}
                        <div className="hidden md:flex items-center gap-2">
                            {['Ana Sayfa', 'Siparişler', 'Raporlar'].map((item) => (
                                <a
                                    key={item}
                                    href={`#/${item.toLowerCase().replace(" ", "")}`}
                                    className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all duration-300 relative group/link"
                                >
                                    {item}
                                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-500 scale-x-0 group-hover/link:scale-x-100 transition-transform duration-500" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Right Side */}
                    <div className="flex items-center gap-4">
                        <div className="h-6 w-px bg-white/10 hidden sm:block" />

                        <UserMenu initials={initials} kullaniciIsmi={kullaniciIsmi} />

                        <button
                            onClick={() => setMobileOpen(true)}
                            className="md:hidden p-2 text-gray-400 hover:text-white"
                        >
                            <Icon.Menu />
                        </button>
                    </div>
                </nav>
            </div>

            {/* Mobile Sidebar - Dark Glass */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setMobileOpen(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] md:hidden"
                        />
                        <motion.div
                            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed top-0 right-0 bottom-0 w-72 bg-[#020617] border-l border-white/10 z-[120] p-8 md:hidden"
                        >
                            <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between mb-12">
                                    <span className="text-xl font-black tracking-widest text-white">MENÜ</span>
                                    <button onClick={() => setMobileOpen(false)} className="text-gray-500 text-xs font-bold italic">KAPAT</button>
                                </div>

                                <div className="space-y-6">
                                    {['Ana Sayfa', 'Siparişler', 'Raporlar'].map(item => (
                                        <a
                                            key={item}
                                            href="#"
                                            className="block text-xl font-black text-gray-500 hover:text-blue-500 transition-all uppercase tracking-tighter"
                                        >
                                            {item}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </header>
    );
}