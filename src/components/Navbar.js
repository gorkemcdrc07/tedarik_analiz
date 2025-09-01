// Navbar.js — saf React + CSS (kütüphanesiz)

import React, { useEffect, useMemo, useState } from "react";
import "./Navbar.css";

const THEME_KEY = "tema"; // "light" | "dark" | "system"

// --- Helpers ---
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
    if (effective === "dark") html.classList.add("dark");
    else html.classList.remove("dark");
    html.setAttribute("data-theme", effective);
}

// --- Basit inline ikonlar (SVG) ---
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

        // Sistem teması değişirse anlık güncelle
        if (themePref === "system" && typeof window !== "undefined") {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            const handler = () => applyTheme("system");
            if (mq.addEventListener) mq.addEventListener("change", handler);
            else if (mq.addListener) mq.addListener(handler); // eski tarayıcılar
            return () => {
                if (mq.removeEventListener) mq.removeEventListener("change", handler);
                else if (mq.removeListener) mq.removeListener(handler);
            };
        }
    }, [themePref]);

    const initials = useMemo(() => {
        if (!kullaniciIsmi) return "?";
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

    // light -> dark -> system döngüsü
    const cycleTheme = () =>
        setThemePref((prev) => (prev === "light" ? "dark" : prev === "dark" ? "system" : "light"));

    const themeLabel =
        themePref === "system" ? "Sistem" : activeTheme === "dark" ? "Koyu" : "Açık";

    return (
        <header className="nv-wrapper" role="banner">
            <nav className="nv" aria-label="Üst menü">
                {/* Sol: Marka + Mobil Menü */}
                <div className="nv-left">
                    <button
                        className="nv-iconbtn md-hidden"
                        aria-label="Menüyü aç"
                        onClick={() => setMobileOpen(true)}
                        type="button"
                    >
                        <Icon.Menu />
                    </button>
                    <div className="nv-brand">
                        <div className="nv-logo" aria-hidden />
                        <span className="nv-brand-text">Uygulama</span>
                    </div>
                </div>

                {/* Sağ: Tema + Kullanıcı + Çıkış */}
                <div className="nv-right">
                    <button className="nv-btn" onClick={cycleTheme} aria-label="Temayı değiştir" type="button">
                        {themePref === "system" ? <Icon.Laptop /> : activeTheme === "dark" ? <Icon.Moon /> : <Icon.Sun />}
                        <span className="nv-btn-label">{themeLabel}</span>
                    </button>

                    <div className="nv-user">
                        <div className="nv-avatar" aria-hidden>
                            <span>{initials}</span>
                        </div>
                        <span className="nv-username" title={kullaniciIsmi || "Misafir"}>
                            {kullaniciIsmi || "Misafir"}
                        </span>
                    </div>

                    <button className="nv-btn nv-secondary" onClick={handleLogout} type="button">
                        <Icon.Logout />
                        <span className="nv-btn-label">Çıkış</span>
                    </button>
                </div>
            </nav>

            {/* Mobil Drawer */}
            <div
                className="nv-sheet"
                data-open={mobileOpen ? "true" : "false"}
                onClick={() => setMobileOpen(false)}
                aria-hidden={mobileOpen ? "false" : "true"}
            >
                <div className="nv-drawer" onClick={(e) => e.stopPropagation()}>
                    <div className="nv-drawer-header">
                        <div className="nv-brand">
                            <div className="nv-logo" aria-hidden />
                            <span className="nv-brand-text">Uygulama</span>
                        </div>
                        <button
                            className="nv-iconbtn"
                            aria-label="Menüyü kapat"
                            onClick={() => setMobileOpen(false)}
                            type="button"
                        >
                            ×
                        </button>
                    </div>
                    <div className="nv-drawer-body">
                        <a className="nv-link" href="#/">Ana Sayfa</a>
                        <a className="nv-link" href="#/ozellikler">Özellikler</a>
                        <a className="nv-link" href="#/hakkinda">Hakkında</a>
                    </div>
                </div>
            </div>
        </header>
    );
}
