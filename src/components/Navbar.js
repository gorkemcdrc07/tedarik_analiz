import React, { useEffect, useMemo, useState } from "react";

const THEME_KEY = "tema";

// --- Helpers (Değişmedi) ---
function readUserName() {
    try {
        const raw = localStorage.getItem("kullanici");
        if (!raw) return "";
        const parsed = JSON.parse(raw);
        return (parsed && parsed.kullanici) ? parsed.kullanici : "";
    } catch {
        return "";
    }
}

function getSystemPrefersDark() {
    return (
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
}

function resolveActiveTheme(storedTheme) {
    if (storedTheme === "system") {
        return getSystemPrefersDark() ? "dark" : "light";
    }
    return storedTheme || (getSystemPrefersDark() ? "dark" : "light");
}

function applyTheme(themePref) {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const effective = resolveActiveTheme(themePref);

    if (effective === "dark") {
        html.classList.add("dark");
    }
    else {
        html.classList.remove("dark");
    }
    html.setAttribute("data-theme", effective);
}

// --- Inline İkonlar (Değişmedi) ---
const Icon = {
    Sun: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path
                fill="currentColor"
                d="M12 4a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4Zm7.07 2.93a1 1 0 0 1 1.41 0h0a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71ZM20 11a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2h1ZM6.64 6.34a1 1 0 0 1 0 1.41 1 1 0 0 1-1.41 0l-.71-.71a1 1 0 0 1 0-1.41h0a1 1 0 0 1 1.41 0l.71.71ZM12 18a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm6.36-1.34a1 1 0 0 1 1.41 0l.71.71a1 1 0 0 1-1.41 1.41l-.71-.71a1 1 0 0 1 0-1.41ZM4 11a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1Zm2.34 6.36a1 1 0 0 1 1.41 0 1 1 0 0 1 0 1.41l-.71.71a1 1 0 0 1-1.41-1.41l.71-.71ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
            />
        </svg>
    ),
    Moon: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
    ),
    Laptop: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7H4V6Zm-2 9h20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z" />
        </svg>
    ),
    Logout: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M10 17a1 1 0 0 1 1 1v2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5v2a1 1 0 0 1-2 0V5H6v14h3v-1a1 1 0 0 1 1-1Zm9-5-3-3v2h-6a1 1 0 1 0 0 2h6v2l3-3Z" />
        </svg>
    ),
    Menu: (props) => (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...props}>
            <path fill="currentColor" d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" />
        </svg>
    ),
    User: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.33 0-8 2.17-8 5v1h16v-1c0-2.83-3.67-5-8-5Z" />
        </svg>
    ),
    Close: (props) => (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden {...props}>
            <path fill="currentColor" d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89a.996.996 0 0 0 0-1.4Z" />
        </svg>
    ),
    ChevronDown: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M7 10l5 5 5-5z" />
        </svg>
    ),
};

// --- Yeni Açılır Menü Bileşeni (Basit) ---
const UserMenu = ({ initials, kullaniciIsmi, handleLogout }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Dışarı tıklayınca kapanması için useEffect eklenebilir.
    useEffect(() => {
        const handler = (event) => {
            if (event.target.closest("#user-menu-button") || event.target.closest("#user-menu-dropdown")) return;
            setIsOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div className="relative">
            <button
                id="user-menu-button"
                className="flex items-center space-x-2 px-1 sm:px-3 py-1 rounded-full dark:bg-gray-800/70 bg-gray-100/70 cursor-pointer border dark:border-gray-700/60 border-gray-300/60 hover:shadow-lg hover:shadow-indigo-500/10 transition duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls="user-menu-dropdown"
                type="button"
            >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-600 text-white font-semibold text-sm shadow-md ring-2 ring-indigo-500/50" aria-hidden>
                    {initials}
                </div>
                <span className="hidden lg:inline text-sm font-semibold dark:text-gray-100 text-gray-800 truncate max-w-[120px]" title={kullaniciIsmi || "Misafir"}>
                    {kullaniciIsmi || "Misafir"}
                </span>
                <Icon.ChevronDown className={`ml-1 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>

            {/* Açılır Menü */}
            <div
                id="user-menu-dropdown"
                className={`absolute right-0 mt-2 w-48 rounded-lg shadow-xl dark:bg-gray-800 bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 dark:divide-gray-700 transition-opacity transform origin-top-right ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="user-menu-button"
            >
                <div className="py-1" role="none">
                    <div className="block px-4 py-2 text-xs text-gray-500 dark:text-gray-400 truncate" role="menuitem">
                        {kullaniciIsmi || "Misafir"}
                    </div>
                </div>
                <div className="py-1" role="none">
                    <a
                        href="#/profil"
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        role="menuitem"
                        onClick={() => setIsOpen(false)}
                    >
                        <Icon.User className="w-4 h-4" />
                        <span>Profilim</span>
                    </a>
                </div>
                <div className="py-1" role="none">
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/40 transition-colors rounded-b-lg"
                        role="menuitem"
                    >
                        <Icon.Logout className="w-4 h-4" />
                        <span>Çıkış Yap</span>
                    </button>
                </div>
            </div>
        </div>
    );
};


export default function Navbar() {
    const [kullaniciIsmi, setKullaniciIsmi] = useState("");
    const [themePref, setThemePref] = useState(() => {
        try {
            return localStorage.getItem(THEME_KEY) || "system";
        } catch {
            return "system";
        }
    });
    const [mobileOpen, setMobileOpen] = useState(false);

    const activeTheme = useMemo(() => resolveActiveTheme(themePref), [themePref]);

    useEffect(() => {
        setKullaniciIsmi(readUserName());
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(THEME_KEY, themePref);
        } catch { }
        applyTheme(themePref);

        // Sistem teması değişirse anlık güncelleme
        if (themePref === "system" && typeof window !== "undefined") {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            const handler = () => applyTheme("system");
            if (mq.addEventListener) mq.addEventListener("change", handler);
            else if (mq.addListener) mq.addListener(handler);
            return () => {
                if (mq.removeEventListener) mq.removeEventListener("change", handler);
                else if (mq.removeListener) mq.removeListener(handler);
            };
        }
    }, [themePref]);

    const initials = useMemo(() => {
        if (!kullaniciIsmi) return "M"; // Misafir
        return kullaniciIsmi
            .split(/\s+/)
            .map((p) => p[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
    }, [kullaniciIsmi]);

    const handleLogout = () => {
        try {
            localStorage.removeItem("kullanici");
        } catch { }
        window.location.reload();
    };


    const cycleTheme = () =>
        setThemePref((prev) => (prev === "light" ? "dark" : prev === "dark" ? "system" : "light"));

    const themeLabel =
        themePref === "system" ? "Sistem" : activeTheme === "dark" ? "Koyu" : "Açık";

    // Tailwind CSS Sınıfları Kullanıldı
    return (
        <header
            // Yapışkanlık, Yüksek Z-indeksi, Opak/Bulanık Arka Plan
            className="sticky top-0 z-50 w-full shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 backdrop-blur-xl transition-colors duration-300 dark:bg-gray-950/80 bg-white/80 border-b dark:border-gray-800/60 border-gray-200/60"
            role="banner"
        >
            <nav className="flex items-center justify-between h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Üst menü">

                {/* Sol Alan: Mobil Menü Butonu ve Marka */}
                <div className="flex items-center space-x-4">
                    <button
                        // Yuvarlak, minimalist buton
                        className="p-2 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 md:hidden transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        aria-label="Menüyü aç"
                        onClick={() => setMobileOpen(true)}
                        type="button"
                    >
                        <Icon.Menu />
                    </button>
                    <a href="#/" className="flex items-center space-x-2 group focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1 -m-1">
                        {/* LOGO İKONU GÜNCELLENDİ: 'U' yerine 'STS' */}
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-600 to-cyan-500 text-white font-extrabold text-lg shadow-lg shadow-indigo-500/50 transition-transform group-hover:scale-105" aria-hidden>
                            STS
                        </div>
                        {/* UYGULAMA ADI GÜNCELLENDİ: 'Uygulama' yerine 'STS' */}
                    </a>
                </div>

                {/* Orta Alan: Navigasyon Linkleri (Geniş Ekran) */}
                <div className="hidden md:flex space-x-1">
                    {['Ana Sayfa', 'Siparişler', 'Raporlar'].map((label, index) => (
                        <a
                            key={label}
                            // Link stili: Aktiflik için hafif renk, daha belirgin hover
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${index === 0 // İlk linki "aktif" kabul edelim
                                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70 hover:text-indigo-600 dark:hover:text-indigo-400'
                                } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                            href={`#/${label.toLowerCase().replace(/\s/g, "")}`}
                        >
                            {label}
                        </a>
                    ))}
                </div>


                {/* Sağ Alan: Tema, Kullanıcı ve Çıkış */}
                <div className="flex items-center space-x-2 sm:space-x-3">
                    {/* Tema Butonu: Dairesel buton yerine daha göze çarpan kapsül buton */}
                    <button
                        className="flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium dark:bg-gray-700/70 dark:text-white bg-gray-200/70 text-gray-800 hover:ring-2 hover:ring-indigo-500/70 transition-all duration-300 shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onClick={cycleTheme}
                        aria-label="Temayı değiştir"
                        type="button"
                        title={`Tema: ${themeLabel}`}
                    >
                        {themePref === "system" ? <Icon.Laptop /> : activeTheme === "dark" ? <Icon.Moon /> : <Icon.Sun />}
                        <span className="hidden sm:inline">{themeLabel}</span>
                    </button>

                    {/* Kullanıcı Bilgisi: Açılır Menüye dönüştü */}
                    <UserMenu initials={initials} kullaniciIsmi={kullaniciIsmi} handleLogout={handleLogout} />

                </div>
            </nav>

            {/* --- Mobil Menü (Drawer/Sheet) --- */}
            <div
                // Çekmece alanı (Gölge, tam ekran, animasyonlu)
                className={`fixed inset-0 transform transition-transform duration-500 ease-in-out md:hidden z-[60] ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
                data-open={mobileOpen ? "true" : "false"}
                aria-hidden={mobileOpen ? "false" : "true"}
            >
                {/* Overlay/Arka Plan: Tıklayınca kapanır */}
                <div
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)}
                />

                {/* Çekmece (Drawer): Sol tarafa sabitlenmiş panel */}
                <div className="absolute top-0 left-0 w-64 h-full shadow-2xl dark:bg-gray-950 bg-white flex flex-col transition-all duration-500" onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 border-b dark:border-gray-800 border-gray-200 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            {/* LOGO İKONU GÜNCELLENDİ: 'U' yerine 'STS' */}
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-600 text-white font-extrabold text-lg shadow-lg" aria-hidden>
                                STS
                            </div>
                            {/* UYGULAMA ADI GÜNCELLENDİ: 'Uygulama' yerine 'STS' */}
                            <span className="text-lg font-extrabold dark:text-white text-gray-900">STS</span>
                        </div>
                        <button
                            className="p-1 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            aria-label="Menüyü kapat"
                            onClick={() => setMobileOpen(false)}
                            type="button"
                        >
                            <Icon.Close />
                        </button>
                    </div>

                    <div className="p-4 flex flex-col space-y-2 flex-grow">
                        {/* Mobil Linkler güncellendi: 'Özellikler' ve 'Hakkında' yerine 'Siparişler' ve 'Raporlar' */}
                        <a className="flex items-center space-x-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/30 dark:hover:text-indigo-300 hover:text-indigo-600 font-medium transition" href="#/" onClick={() => setMobileOpen(false)}><Icon.Sun className="w-5 h-5 opacity-0" /><span>Ana Sayfa</span></a>
                        <a className="flex items-center space-x-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/30 dark:hover:text-indigo-300 hover:text-indigo-600 font-medium transition" href="#/siparisler" onClick={() => setMobileOpen(false)}><Icon.Sun className="w-5 h-5 opacity-0" /><span>Siparişler</span></a>
                        <a className="flex items-center space-x-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/30 dark:hover:text-indigo-300 hover:text-indigo-600 font-medium transition" href="#/raporlar" onClick={() => setMobileOpen(false)}><Icon.Sun className="w-5 h-5 opacity-0" /><span>Raporlar</span></a>
                    </div>

                    <div className="p-4 border-t dark:border-gray-800 border-gray-200">
                        {/* Mobil Kullanıcı Bilgisi */}
                        <div className="flex items-center space-x-3 p-3 rounded-xl dark:bg-gray-800/70 bg-gray-100/70 border dark:border-gray-700 border-gray-300 mb-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-600 text-white font-semibold text-lg" aria-hidden>
                                {initials}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-base font-semibold dark:text-gray-100 text-gray-800 truncate" title={kullaniciIsmi || "Misafir"}>
                                    {kullaniciIsmi || "Misafir"}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Kullanıcı</span>
                            </div>
                        </div>

                        {/* Mobil Çıkış Butonu */}
                        <button
                            className="flex items-center justify-center w-full space-x-2 px-3 py-3 rounded-xl text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                            onClick={handleLogout}
                            type="button"
                        >
                            <Icon.Logout className="w-5 h-5" />
                            <span className="font-semibold">Çıkış Yap</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}