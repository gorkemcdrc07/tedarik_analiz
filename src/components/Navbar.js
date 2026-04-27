import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ---------- HELPERS ---------- */
const readUserName = () => {
    try {
        const raw = localStorage.getItem("kullanici");
        if (!raw) return "";
        const parsed = JSON.parse(raw);
        return parsed?.kullanici || "";
    } catch {
        return "";
    }
};

/* ---------- ICONS ---------- */
const Icon = {
    Menu: () => (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
    ),
    LogOut: () => (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
    ),
    ChevronDown: () => (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="m6 9 6 6 6-6" />
        </svg>
    )
};

/* ---------- USER MENU ---------- */
const UserMenu = ({ initials, kullaniciIsmi }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef();

    useEffect(() => {
        const close = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const logout = () => {
        localStorage.clear();
        window.location.reload();
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl hover:bg-white/10"
            >
                <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-xs font-bold text-white">
                    {initials}
                </div>

                <span className="hidden sm:block text-xs text-gray-300 font-bold uppercase">
                    {kullaniciIsmi || "Admin"}
                </span>

                <Icon.ChevronDown />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-3 w-44 bg-[#0f172a] border border-white/10 rounded-xl p-2"
                    >
                        <button
                            onClick={logout}
                            className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg flex gap-2 items-center"
                        >
                            <Icon.LogOut />
                            ÇIKIŞ
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/* ---------- NAVBAR ---------- */
export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [kullaniciIsmi, setKullaniciIsmi] = useState("");

    useEffect(() => {
        setKullaniciIsmi(readUserName());
    }, []);

    const initials = useMemo(() => {
        if (!kullaniciIsmi) return "AD";
        return kullaniciIsmi
            .split(" ")
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    }, [kullaniciIsmi]);

    return (
        <header className="sticky top-0 z-50 w-full px-4 py-2">

            <div className="max-w-7xl mx-auto">
                <nav className="flex justify-between items-center h-14 px-5 rounded-xl bg-[#020617]/90 backdrop-blur-xl border border-white/10">

                    {/* LOGO */}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
                            <span className="text-white font-black text-sm">STS</span>
                        </div>
                        <span className="hidden md:block text-white font-black tracking-widest text-sm">
                            Fleet<span className="text-blue-500">OS</span>
                        </span>
                    </div>

                    {/* RIGHT */}
                    <div className="flex items-center gap-3">
                        <UserMenu initials={initials} kullaniciIsmi={kullaniciIsmi} />

                        <button
                            onClick={() => setMobileOpen(true)}
                            className="md:hidden text-gray-400"
                        >
                            <Icon.Menu />
                        </button>
                    </div>

                </nav>
            </div>

        </header>
    );
}