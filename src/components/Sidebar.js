import React, { useMemo, useState, useRef, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";

/* ─── CONSTANTS ──────────────────────────────────── */
const TOPBAR_HEIGHT = 64;

/* ─── ICONS ──────────────────────────────────────── */
const Icon = {
    dashboard: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="6" height="6" rx="1.5" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" />
        </svg>
    ),
    orders: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 2h12l-1.5 8H3.5L2 2z" />
            <circle cx="5.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="10.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
        </svg>
    ),
    finance: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1v14M5 4h4.5a2 2 0 010 4H5m0 3h5a2 2 0 010 4H5" />
        </svg>
    ),
    analytics: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 13l4-5 3 3 3-4 4 5" />
        </svg>
    ),
    logout: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M6 3H3.5A1.5 1.5 0 002 4.5v7A1.5 1.5 0 003.5 13H6" />
            <path d="M10 4.5l3.5 3.5-3.5 3.5" />
            <path d="M14 8H6" />
        </svg>
    ),
    chevron: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
    ),
};

/* ─── MENU CONFIG ─────────────────────────────────── */
const useMenuConfig = () =>
    useMemo(() => [
        {
            title: "Dashboard",
            route: "/dashboard",
            icon: Icon.dashboard,
        },
        {
            title: "Sipariş İşlemleri",
            icon: Icon.orders,
            groupLabel: "Operasyon",
            subItems: [
                { label: "Sipariş Oluştur", route: "/SiparisIslemleri/SiparisOlustur" },
                { label: "Parsiyel Sipariş", route: "/SiparisIslemleri/ParsiyelSiparisOlustur" },
                { label: "Teslim Noktaları", route: "/SiparisIslemleri/TeslimNoktalari" }, // ✅ DÜZELDİ
                { label: "Sipariş Açanlar", route: "/SiparisIslemleri/SiparisAcanlar" },
                { label: "Arkas", route: "/SiparisIslemleri/Arkas" },
                { label: "Fasdat", route: "/SiparisIslemleri/Fasdat" },
            ]
        },
        {
            title: "Finans",
            icon: Icon.finance,
            sections: [
                {
                    groupLabel: "Gelir & Gider",
                    subItems: [
                        { label: "Gelir Ekleme", route: "/GelirGider/GelirEkleme" },
                        { label: "Gider Ekleme", route: "/GelirGider/GiderEkleme" },
                        { label: "Eskalasyon", route: "/eskalasyon" },
                    ],
                },
                {
                    groupLabel: "Fiyatlandırma",
                    subItems: [
                        { label: "Sefer Fiyatlandırma", route: "/fiyatlandirma/seferFiyatlandirma" },
                        { label: "Fiyat Listesi", route: "/Fiyatlandirma/FiyatListesi" },
                    ],
                },
            ],
        },
        {
            title: "Analiz",
            icon: Icon.analytics,
            groupLabel: "Raporlama",
            subItems: [
                { label: "Özet Tablo", route: "/analiz/ozet" },
                { label: "Görsel Analiz", route: "/gorsel" },
            ],
        },
    ], []);

/* ─── HELPERS ─────────────────────────────────────── */
function getInitials(name = "") {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("");
}

function shortName(name = "") {
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
}

/* ═══════════════════════════════════════════════════
   TOPBAR COMPONENT
═══════════════════════════════════════════════════ */
const Topbar = () => {
    const location = useLocation();
    const [openGroup, setOpenGroup] = useState(null);
    const [userName, setUserName] = useState("");
    const [userRole, setUserRole] = useState("Operasyon Yetkilisi");
    const topbarRef = useRef(null);
    const menuConfig = useMenuConfig();

    /* ─── Load user from localStorage ─────────── */
    useEffect(() => {
        const name =
            localStorage.getItem("userName") ||
            localStorage.getItem("user_name") ||
            localStorage.getItem("displayName") ||
            localStorage.getItem("name") ||
            sessionStorage.getItem("userName") ||
            "";

        const role =
            localStorage.getItem("userRole") ||
            localStorage.getItem("user_role") ||
            localStorage.getItem("title") ||
            sessionStorage.getItem("userRole") ||
            "Operasyon Yetkilisi";

        if (name) setUserName(name);
        setUserRole(role);
    }, []);

    /* ─── Click outside close ──────────────────── */
    useEffect(() => {
        const handler = (e) => {
            if (topbarRef.current && !topbarRef.current.contains(e.target)) {
                setOpenGroup(null);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    /* ─── Logout ───────────────────────────────── */
    const handleLogout = () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/login";
    };

    const isGroupActive = (item) => {
        const allSubs = item.sections
            ? item.sections.flatMap((s) => s.subItems)
            : item.subItems || [];
        return allSubs.some((s) => location.pathname === s.route);
    };

    const initials = getInitials(userName) || "U";
    const displayName = shortName(userName) || "Kullanıcı";

    /* ─── RENDER ───────────────────────────────── */
    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

                .tb-root * { box-sizing: border-box; }

                .tb-root {
                    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
                    position: fixed;
                    top: 0; left: 0; right: 0;
                    height: ${TOPBAR_HEIGHT}px;
                    z-index: 1300;
                    display: flex;
                    align-items: center;
                    padding: 0 20px;
                    gap: 6px;
                    background: rgba(8, 11, 20, 0.88);
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    backdrop-filter: blur(20px) saturate(160%);
                    -webkit-backdrop-filter: blur(20px) saturate(160%);
                }

                .tb-logo {
                    display: flex; align-items: center; gap: 10px;
                    text-decoration: none; flex-shrink: 0; margin-right: 10px;
                }
                .tb-logo-mark {
                    width: 34px; height: 34px; border-radius: 10px;
                    background: linear-gradient(140deg, #3b82f6 0%, #6366f1 60%, #8b5cf6 100%);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 15px; font-weight: 900; color: #fff;
                    box-shadow: 0 4px 14px rgba(99,102,241,0.35);
                    flex-shrink: 0;
                }
                .tb-logo-text {
                    font-size: 15px; font-weight: 800; color: #f1f5f9;
                    letter-spacing: -0.03em;
                }
                .tb-logo-text span { color: #60a5fa; }

                .tb-divider {
                    width: 1px; height: 26px;
                    background: rgba(255,255,255,0.08);
                    margin: 0 10px; flex-shrink: 0;
                }

                .tb-nav { display: flex; align-items: center; gap: 2px; flex: 1; }
                .tb-nav-item { position: relative; }

                .tb-nav-btn {
                    display: flex; align-items: center; gap: 7px;
                    height: 36px; padding: 0 12px;
                    border-radius: 10px;
                    border: 1px solid transparent;
                    background: transparent;
                    color: rgba(148,163,184,0.75);
                    font-size: 13px; font-weight: 600;
                    cursor: pointer; white-space: nowrap;
                    text-decoration: none;
                    transition: background 0.14s, color 0.14s, border-color 0.14s;
                }
                .tb-nav-btn:hover { background: rgba(255,255,255,0.06); color: #e2e8f0; }
                .tb-nav-btn.is-active {
                    background: rgba(59,130,246,0.12);
                    border-color: rgba(59,130,246,0.22);
                    color: #93c5fd;
                }
                .tb-nav-btn.is-open { background: rgba(255,255,255,0.07); color: #e2e8f0; }

                .tb-nav-icon {
                    width: 22px; height: 22px; border-radius: 7px;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(255,255,255,0.06); flex-shrink: 0;
                    transition: background 0.14s;
                }
                .tb-nav-btn.is-active .tb-nav-icon { background: rgba(59,130,246,0.2); }

                .tb-chevron { opacity: 0.55; flex-shrink: 0; transition: transform 0.2s ease; }
                .tb-chevron.open { transform: rotate(180deg); }

                .tb-dropdown {
                    position: absolute;
                    top: calc(100% + 10px); left: 0;
                    min-width: 230px;
                    background: #0b1022;
                    border: 1px solid rgba(255,255,255,0.09);
                    border-radius: 16px; padding: 6px;
                    box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03);
                    z-index: 200;
                    animation: ddFade 0.14s ease;
                }
                @keyframes ddFade {
                    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }

                .tb-dd-label {
                    font-size: 10px; font-weight: 700;
                    color: rgba(100,116,139,0.6);
                    padding: 6px 10px 4px;
                    text-transform: uppercase; letter-spacing: 0.1em;
                }
                .tb-dd-sep { height: 1px; background: rgba(255,255,255,0.06); margin: 4px 0; }

                .tb-dd-item {
                    display: flex; align-items: center; gap: 10px;
                    padding: 9px 10px; border-radius: 10px;
                    color: rgba(203,213,225,0.75);
                    font-size: 13px; font-weight: 500;
                    text-decoration: none; cursor: pointer;
                    transition: background 0.12s, color 0.12s;
                }
                .tb-dd-item:hover { background: rgba(255,255,255,0.06); color: #e2e8f0; }
                .tb-dd-item.is-active {
                    background: rgba(59,130,246,0.13);
                    color: #93c5fd; font-weight: 700;
                }

                .tb-dd-dot {
                    width: 5px; height: 5px; border-radius: 50%;
                    background: currentColor; opacity: 0.5; flex-shrink: 0;
                }
                .tb-dd-item.is-active .tb-dd-dot { opacity: 1; }

                .tb-right {
                    display: flex; align-items: center;
                    gap: 8px; margin-left: auto; flex-shrink: 0;
                }

                .tb-user {
                    display: flex; align-items: center; gap: 10px;
                    padding: 5px 14px 5px 5px;
                    border-radius: 40px;
                    border: 1px solid rgba(255,255,255,0.08);
                    background: rgba(255,255,255,0.04);
                    transition: border-color 0.14s, background 0.14s;
                }
                .tb-user:hover {
                    border-color: rgba(255,255,255,0.13);
                    background: rgba(255,255,255,0.07);
                }

                .tb-avatar {
                    width: 30px; height: 30px; border-radius: 50%;
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 11px; font-weight: 800; color: #fff;
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(99,102,241,0.35);
                }

                .tb-user-info { display: flex; flex-direction: column; gap: 1px; }
                .tb-user-name {
                    font-size: 12.5px; font-weight: 700;
                    color: rgba(226,232,240,0.9);
                    white-space: nowrap; line-height: 1;
                }
                .tb-user-role {
                    font-size: 10.5px; font-weight: 500;
                    color: rgba(100,116,139,0.7);
                    white-space: nowrap; line-height: 1;
                }

                .tb-status {
                    width: 7px; height: 7px; border-radius: 50%;
                    background: #34d399;
                    box-shadow: 0 0 0 2px rgba(52,211,153,0.25);
                    flex-shrink: 0;
                }

                .tb-logout {
                    height: 34px; padding: 0 13px;
                    border-radius: 10px;
                    border: 1px solid rgba(239,68,68,0.2);
                    background: rgba(239,68,68,0.08);
                    color: rgba(252,165,165,0.85);
                    font-size: 12.5px; font-weight: 700;
                    cursor: pointer;
                    display: flex; align-items: center; gap: 7px;
                    transition: background 0.14s, border-color 0.14s, color 0.14s;
                    white-space: nowrap;
                }
                .tb-logout:hover {
                    background: rgba(239,68,68,0.16);
                    border-color: rgba(239,68,68,0.35);
                    color: #fca5a5;
                }
            `}</style>

            <header className="tb-root" ref={topbarRef}>

                {/* Logo */}
                <NavLink to="/dashboard" className="tb-logo">
                    <div className="tb-logo-mark">F</div>
                    <span className="tb-logo-text">Fleet<span>OS</span></span>
                </NavLink>

                <div className="tb-divider" />

                {/* Nav */}
                <nav className="tb-nav">
                    {menuConfig.map((item) => {
                        const groupActive = isGroupActive(item);
                        const isOpen = openGroup === item.title;
                        const isDirect = !!item.route;
                        const routeActive = isDirect && location.pathname === item.route;

                        if (isDirect) {
                            return (
                                <NavLink
                                    key={item.title}
                                    to={item.route}
                                    className={`tb-nav-btn${routeActive ? " is-active" : ""}`}
                                >
                                    <span className="tb-nav-icon">{item.icon}</span>
                                    {item.title}
                                </NavLink>
                            );
                        }

                        return (
                            <div key={item.title} className="tb-nav-item">
                                <button
                                    className={`tb-nav-btn${groupActive ? " is-active" : isOpen ? " is-open" : ""}`}
                                    onClick={() => setOpenGroup(isOpen ? null : item.title)}
                                >
                                    <span className="tb-nav-icon">{item.icon}</span>
                                    {item.title}
                                    <span className={`tb-chevron${isOpen ? " open" : ""}`}>
                                        {Icon.chevron}
                                    </span>
                                </button>

                                {isOpen && (
                                    <div className="tb-dropdown">
                                        {item.sections
                                            ? item.sections.map((sec, si) => (
                                                <React.Fragment key={sec.groupLabel}>
                                                    {si > 0 && <div className="tb-dd-sep" />}
                                                    <div className="tb-dd-label">{sec.groupLabel}</div>
                                                    {sec.subItems.map((sub) => {
                                                        const active = location.pathname === sub.route;
                                                        return (
                                                            <NavLink
                                                                key={sub.route}
                                                                to={sub.route}
                                                                className={`tb-dd-item${active ? " is-active" : ""}`}
                                                                onClick={() => setOpenGroup(null)}
                                                            >
                                                                <span className="tb-dd-dot" />
                                                                {sub.label}
                                                            </NavLink>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            ))
                                            : (
                                                <>
                                                    {item.groupLabel && (
                                                        <div className="tb-dd-label">{item.groupLabel}</div>
                                                    )}
                                                    {item.subItems.map((sub) => {
                                                        const active = location.pathname === sub.route;
                                                        return (
                                                            <NavLink
                                                                key={sub.route}
                                                                to={sub.route}
                                                                className={`tb-dd-item${active ? " is-active" : ""}`}
                                                                onClick={() => setOpenGroup(null)}
                                                            >
                                                                <span className="tb-dd-dot" />
                                                                {sub.label}
                                                            </NavLink>
                                                        );
                                                    })}
                                                </>
                                            )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Right */}
                <div className="tb-right">
                    <div className="tb-user">
                        <div className="tb-avatar">{initials}</div>
                        <div className="tb-user-info">
                            <span className="tb-user-name">{displayName}</span>
                            <span className="tb-user-role">{userRole}</span>
                        </div>
                        <div className="tb-status" title="Çevrimiçi" />
                    </div>

                    <button className="tb-logout" onClick={handleLogout}>
                        {Icon.logout}
                        Çıkış
                    </button>
                </div>

            </header>

            <div style={{ height: TOPBAR_HEIGHT }} />
        </>
    );
};

export default Topbar;